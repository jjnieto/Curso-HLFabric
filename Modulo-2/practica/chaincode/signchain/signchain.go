package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
	contractapi.Contract
}

type Document struct {
	DocType         string      `json:"docType"`
	ID              string      `json:"id"`
	Hash            string      `json:"hash"`
	Title           string      `json:"title"`
	Description     string      `json:"description"`
	CreatedBy       string      `json:"createdBy"`
	CreatedByCertID string      `json:"createdByCertID"`
	CreatedAt       string      `json:"createdAt"`
	Status          string      `json:"status"`
	Signatures      []Signature `json:"signatures"`
	RejectionReason string      `json:"rejectionReason,omitempty"`
}

type Signature struct {
	Org          string `json:"org"`
	SignerCertID string `json:"signerCertID"`
	Signature    string `json:"signature"`
	Timestamp    string `json:"timestamp"`
}

const (
	StatusPending             = "pending"
	StatusApprovedByCliente   = "approved-by-cliente"
	StatusApprovedByProveedor = "approved-by-proveedor"
	StatusFullyApproved       = "fully-approved"
	StatusRejected            = "rejected"
	StatusCancelled           = "cancelled"
)

func (s *SmartContract) CreateDocument(ctx contractapi.TransactionContextInterface,
	id, hash, title, description string) error {

	mspID, _ := ctx.GetClientIdentity().GetMSPID()
	if mspID != "ClienteMSP" {
		return fmt.Errorf("solo Cliente puede crear documentos (caller: %s)", mspID)
	}

	if id == "" {
		return fmt.Errorf("el id no puede estar vacío")
	}
	if !isValidSha256(hash) {
		return fmt.Errorf("el hash debe ser SHA-256 (64 chars hex), recibido: %d chars", len(hash))
	}
	if title == "" {
		return fmt.Errorf("el título no puede estar vacío")
	}

	existing, err := ctx.GetStub().GetState("doc_" + id)
	if err != nil {
		return fmt.Errorf("error leyendo state: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("el documento %s ya existe", id)
	}

	certID, err := getCallerCertID(ctx)
	if err != nil {
		return fmt.Errorf("error obteniendo cert del caller: %v", err)
	}

	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()
	createdAt := time.Unix(txTimestamp.Seconds, 0).UTC().Format(time.RFC3339)

	doc := Document{
		DocType:         "document",
		ID:              id,
		Hash:            hash,
		Title:           title,
		Description:     description,
		CreatedBy:       mspID,
		CreatedByCertID: certID,
		CreatedAt:       createdAt,
		Status:          StatusPending,
		Signatures:      []Signature{},
	}

	docJSON, _ := json.Marshal(doc)
	if err := ctx.GetStub().PutState("doc_"+id, docJSON); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("DocumentCreated", []byte(fmt.Sprintf(
		`{"id":"%s","hash":"%s","createdBy":"%s"}`, id, hash, mspID)))
	return nil
}

func (s *SmartContract) ApproveDocument(ctx contractapi.TransactionContextInterface,
	id, signatureBase64 string) error {

	mspID, _ := ctx.GetClientIdentity().GetMSPID()
	if mspID != "ClienteMSP" && mspID != "ProveedorMSP" {
		return fmt.Errorf("solo Cliente o Proveedor pueden firmar (caller: %s)", mspID)
	}

	if signatureBase64 == "" {
		return fmt.Errorf("la firma no puede estar vacía")
	}

	doc, err := s.readDocument(ctx, id)
	if err != nil {
		return err
	}

	if doc.Status == StatusFullyApproved {
		return fmt.Errorf("el documento ya está totalmente aprobado")
	}
	if doc.Status == StatusRejected {
		return fmt.Errorf("el documento está rechazado, no se puede firmar")
	}
	if doc.Status == StatusCancelled {
		return fmt.Errorf("el documento está cancelado, no se puede firmar")
	}

	for _, sig := range doc.Signatures {
		if sig.Org == mspID {
			return fmt.Errorf("la organización %s ya ha firmado este documento", mspID)
		}
	}

	certID, err := getCallerCertID(ctx)
	if err != nil {
		return err
	}

	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()
	ts := time.Unix(txTimestamp.Seconds, 0).UTC().Format(time.RFC3339)

	signature := Signature{
		Org:          mspID,
		SignerCertID: certID,
		Signature:    signatureBase64,
		Timestamp:    ts,
	}
	doc.Signatures = append(doc.Signatures, signature)

	if len(doc.Signatures) == 2 {
		doc.Status = StatusFullyApproved
	} else if mspID == "ClienteMSP" {
		doc.Status = StatusApprovedByCliente
	} else {
		doc.Status = StatusApprovedByProveedor
	}

	docJSON, _ := json.Marshal(doc)
	if err := ctx.GetStub().PutState("doc_"+id, docJSON); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("DocumentApproved", []byte(fmt.Sprintf(
		`{"id":"%s","org":"%s","newStatus":"%s"}`, id, mspID, doc.Status)))
	return nil
}

func (s *SmartContract) RejectDocument(ctx contractapi.TransactionContextInterface,
	id, reason string) error {

	mspID, _ := ctx.GetClientIdentity().GetMSPID()
	if mspID != "ClienteMSP" && mspID != "ProveedorMSP" {
		return fmt.Errorf("solo Cliente o Proveedor pueden rechazar (caller: %s)", mspID)
	}

	if reason == "" {
		return fmt.Errorf("el motivo del rechazo es obligatorio")
	}

	doc, err := s.readDocument(ctx, id)
	if err != nil {
		return err
	}

	if doc.Status == StatusFullyApproved {
		return fmt.Errorf("el documento ya está aprobado, no se puede rechazar")
	}
	if doc.Status == StatusRejected {
		return fmt.Errorf("el documento ya está rechazado")
	}
	if doc.Status == StatusCancelled {
		return fmt.Errorf("el documento está cancelado")
	}

	doc.Status = StatusRejected
	doc.RejectionReason = fmt.Sprintf("%s (rechazado por %s)", reason, mspID)

	docJSON, _ := json.Marshal(doc)
	if err := ctx.GetStub().PutState("doc_"+id, docJSON); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("DocumentRejected", []byte(fmt.Sprintf(
		`{"id":"%s","org":"%s","reason":"%s"}`, id, mspID, reason)))
	return nil
}

func (s *SmartContract) CancelDocument(ctx contractapi.TransactionContextInterface,
	id string) error {

	mspID, _ := ctx.GetClientIdentity().GetMSPID()

	doc, err := s.readDocument(ctx, id)
	if err != nil {
		return err
	}

	if doc.CreatedBy != mspID {
		return fmt.Errorf("solo el creador (%s) puede cancelar este documento", doc.CreatedBy)
	}

	if doc.Status == StatusFullyApproved {
		return fmt.Errorf("el documento ya está aprobado totalmente, no se puede cancelar")
	}
	if doc.Status == StatusCancelled {
		return fmt.Errorf("el documento ya está cancelado")
	}
	if doc.Status == StatusRejected {
		return fmt.Errorf("el documento ya está rechazado, no es necesario cancelar")
	}

	doc.Status = StatusCancelled

	docJSON, _ := json.Marshal(doc)
	if err := ctx.GetStub().PutState("doc_"+id, docJSON); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("DocumentCancelled", []byte(fmt.Sprintf(
		`{"id":"%s","cancelledBy":"%s"}`, id, mspID)))
	return nil
}

func (s *SmartContract) GetDocument(ctx contractapi.TransactionContextInterface,
	id string) (*Document, error) {
	return s.readDocument(ctx, id)
}

func (s *SmartContract) GetAllDocuments(ctx contractapi.TransactionContextInterface) ([]*Document, error) {
	queryString := `{"selector":{"docType":"document"}}`
	iterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var docs []*Document
	for iterator.HasNext() {
		result, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		var doc Document
		if err := json.Unmarshal(result.Value, &doc); err != nil {
			return nil, err
		}
		docs = append(docs, &doc)
	}
	return docs, nil
}

func (s *SmartContract) GetDocumentHistory(ctx contractapi.TransactionContextInterface,
	id string) ([]map[string]interface{}, error) {

	iterator, err := ctx.GetStub().GetHistoryForKey("doc_" + id)
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var history []map[string]interface{}
	for iterator.HasNext() {
		record, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		entry := map[string]interface{}{
			"txID":      record.TxId,
			"timestamp": record.Timestamp.AsTime().Format(time.RFC3339),
			"isDelete":  record.IsDelete,
		}
		if !record.IsDelete {
			var doc Document
			json.Unmarshal(record.Value, &doc)
			entry["value"] = doc
		}
		history = append(history, entry)
	}
	return history, nil
}

func (s *SmartContract) readDocument(ctx contractapi.TransactionContextInterface,
	id string) (*Document, error) {
	docJSON, err := ctx.GetStub().GetState("doc_" + id)
	if err != nil {
		return nil, fmt.Errorf("error leyendo state: %v", err)
	}
	if docJSON == nil {
		return nil, fmt.Errorf("el documento %s no existe", id)
	}
	var doc Document
	if err := json.Unmarshal(docJSON, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

func isValidSha256(s string) bool {
	if len(s) != 64 {
		return false
	}
	matched, _ := regexp.MatchString("^[a-f0-9]+$", s)
	return matched
}

func getCallerCertID(ctx contractapi.TransactionContextInterface) (string, error) {
	cert, err := ctx.GetClientIdentity().GetX509Certificate()
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(cert.Raw)
	return hex.EncodeToString(hash[:]), nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creando chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error arrancando chaincode: %v", err))
	}
}
