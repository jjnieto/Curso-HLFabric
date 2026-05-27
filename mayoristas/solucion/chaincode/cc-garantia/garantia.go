package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// GarantiaContract gestiona garantías y reclamaciones de productos.
type GarantiaContract struct {
	contractapi.Contract
}

type Garantia struct {
	DocType         string `json:"docType"`
	NumeroSerie     string `json:"numeroSerie"`
	ClienteFinal    string `json:"clienteFinal"`
	FechaActivacion string `json:"fechaActivacion"`
	FechaExpiracion string `json:"fechaExpiracion"`
	Estado          string `json:"estado"`
}

type Reclamacion struct {
	DocType     string `json:"docType"`
	ID          string `json:"id"`
	NumeroSerie string `json:"numeroSerie"`
	Motivo      string `json:"motivo"`
	Estado      string `json:"estado"`
	Resolucion  string `json:"resolucion"`
	Fecha       string `json:"fecha"`
}

// ActivarGarantia vincula una garantía a un cliente final. Solo MinoristaMSP.
func (c *GarantiaContract) ActivarGarantia(ctx contractapi.TransactionContextInterface, numeroSerie, clienteFinal string, mesesGarantia int) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}
	if mspID != "MinoristaMSP" {
		return fmt.Errorf("solo MinoristaMSP puede activar garantías, no %s", mspID)
	}

	key := "GAR~" + numeroSerie
	existing, err := ctx.GetStub().GetState(key)
	if err != nil {
		return fmt.Errorf("error consultando: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("ya existe una garantía para el producto %s", numeroSerie)
	}

	now := time.Now()
	garantia := Garantia{
		DocType:         "garantia",
		NumeroSerie:     numeroSerie,
		ClienteFinal:    clienteFinal,
		FechaActivacion: now.Format(time.RFC3339),
		FechaExpiracion: now.AddDate(0, mesesGarantia, 0).Format(time.RFC3339),
		Estado:          "ACTIVA",
	}

	data, err := json.Marshal(garantia)
	if err != nil {
		return fmt.Errorf("error serializando: %v", err)
	}
	if err := ctx.GetStub().PutState(key, data); err != nil {
		return fmt.Errorf("error guardando: %v", err)
	}

	ctx.GetStub().SetEvent("GarantiaActivada", data)
	return nil
}

// ConsultarGarantia devuelve el estado de la garantía de un producto.
func (c *GarantiaContract) ConsultarGarantia(ctx contractapi.TransactionContextInterface, numeroSerie string) (*Garantia, error) {
	key := "GAR~" + numeroSerie
	data, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("error consultando: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("no existe garantía para el producto %s", numeroSerie)
	}

	var garantia Garantia
	if err := json.Unmarshal(data, &garantia); err != nil {
		return nil, fmt.Errorf("error deserializando: %v", err)
	}
	return &garantia, nil
}

// ReclamarGarantia abre una reclamación contra el fabricante. Solo MinoristaMSP.
func (c *GarantiaContract) ReclamarGarantia(ctx contractapi.TransactionContextInterface, numeroSerie, motivo string) (string, error) {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("error obteniendo MSP ID: %v", err)
	}
	if mspID != "MinoristaMSP" {
		return "", fmt.Errorf("solo MinoristaMSP puede reclamar garantías, no %s", mspID)
	}

	key := "GAR~" + numeroSerie
	data, err := ctx.GetStub().GetState(key)
	if err != nil {
		return "", fmt.Errorf("error consultando: %v", err)
	}
	if data == nil {
		return "", fmt.Errorf("no existe garantía para el producto %s", numeroSerie)
	}

	var garantia Garantia
	if err := json.Unmarshal(data, &garantia); err != nil {
		return "", fmt.Errorf("error deserializando: %v", err)
	}
	if garantia.Estado != "ACTIVA" {
		return "", fmt.Errorf("la garantía no está activa (estado: %s)", garantia.Estado)
	}

	reclamacionID := fmt.Sprintf("REC~%s~%s", numeroSerie, ctx.GetStub().GetTxID())
	reclamacion := Reclamacion{
		DocType:     "reclamacion",
		ID:          reclamacionID,
		NumeroSerie: numeroSerie,
		Motivo:      motivo,
		Estado:      "ABIERTA",
		Fecha:       time.Now().Format(time.RFC3339),
	}

	recData, err := json.Marshal(reclamacion)
	if err != nil {
		return "", fmt.Errorf("error serializando: %v", err)
	}
	if err := ctx.GetStub().PutState(reclamacionID, recData); err != nil {
		return "", fmt.Errorf("error guardando: %v", err)
	}

	garantia.Estado = "RECLAMADA"
	garData, err := json.Marshal(garantia)
	if err != nil {
		return "", fmt.Errorf("error serializando garantía: %v", err)
	}
	if err := ctx.GetStub().PutState(key, garData); err != nil {
		return "", fmt.Errorf("error actualizando garantía: %v", err)
	}

	ctx.GetStub().SetEvent("GarantiaReclamada", recData)
	return reclamacionID, nil
}

// ResolverReclamacion acepta o rechaza una reclamación. Solo FabricanteMSP.
func (c *GarantiaContract) ResolverReclamacion(ctx contractapi.TransactionContextInterface, reclamacionID, resolucion string, aceptada bool) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}
	if mspID != "FabricanteMSP" {
		return fmt.Errorf("solo FabricanteMSP puede resolver reclamaciones, no %s", mspID)
	}

	data, err := ctx.GetStub().GetState(reclamacionID)
	if err != nil {
		return fmt.Errorf("error consultando: %v", err)
	}
	if data == nil {
		return fmt.Errorf("la reclamación %s no existe", reclamacionID)
	}

	var reclamacion Reclamacion
	if err := json.Unmarshal(data, &reclamacion); err != nil {
		return fmt.Errorf("error deserializando: %v", err)
	}
	if reclamacion.Estado != "ABIERTA" {
		return fmt.Errorf("la reclamación no está abierta (estado: %s)", reclamacion.Estado)
	}

	if aceptada {
		reclamacion.Estado = "ACEPTADA"
	} else {
		reclamacion.Estado = "RECHAZADA"
	}
	reclamacion.Resolucion = resolucion

	updatedData, err := json.Marshal(reclamacion)
	if err != nil {
		return fmt.Errorf("error serializando: %v", err)
	}
	if err := ctx.GetStub().PutState(reclamacionID, updatedData); err != nil {
		return fmt.Errorf("error guardando: %v", err)
	}

	garKey := "GAR~" + reclamacion.NumeroSerie
	garData, err := ctx.GetStub().GetState(garKey)
	if err == nil && garData != nil {
		var garantia Garantia
		if json.Unmarshal(garData, &garantia) == nil {
			if aceptada {
				garantia.Estado = "RESUELTA"
			} else {
				garantia.Estado = "ACTIVA"
			}
			if newGarData, err := json.Marshal(garantia); err == nil {
				ctx.GetStub().PutState(garKey, newGarData)
			}
		}
	}

	ctx.GetStub().SetEvent("ReclamacionResuelta", updatedData)
	return nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&GarantiaContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creando el chaincode cc-garantia: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error arrancando el chaincode cc-garantia: %v", err))
	}
}
