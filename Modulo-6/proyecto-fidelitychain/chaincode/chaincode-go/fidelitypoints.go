package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract implementa el contrato de puntos de fidelizacion
type SmartContract struct {
	contractapi.Contract
}

// Client representa un cliente del programa de fidelizacion
type Client struct {
	DocType      string `json:"docType"`
	ClientID     string `json:"clientID"`
	Name         string `json:"name"`
	Balance      int    `json:"balance"`
	RegisteredBy string `json:"registeredBy"`
	CreatedAt    string `json:"createdAt"`
}

// Transaction representa un movimiento de puntos
type Transaction struct {
	DocType     string `json:"docType"`
	TxID        string `json:"txID"`
	ClientID    string `json:"clientID"`
	TxType      string `json:"txType"`
	Amount      int    `json:"amount"`
	Description string `json:"description"`
	Org         string `json:"org"`
	Timestamp   string `json:"timestamp"`
}

// TokenInfo contiene la metadata global del token
type TokenInfo struct {
	DocType       string `json:"docType"`
	Name          string `json:"name"`
	Symbol        string `json:"symbol"`
	TotalSupply   int    `json:"totalSupply"`
	TotalRedeemed int    `json:"totalRedeemed"`
}

// InitLedger inicializa la metadata del token
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	tokenInfo := TokenInfo{
		DocType:       "tokenInfo",
		Name:          "FidelityPoints",
		Symbol:        "FP",
		TotalSupply:   0,
		TotalRedeemed: 0,
	}
	tokenJSON, err := json.Marshal(tokenInfo)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState("tokenInfo", tokenJSON)
}

// RegisterClient registra un nuevo cliente identificado por su DNI
func (s *SmartContract) RegisterClient(ctx contractapi.TransactionContextInterface,
	clientID string, name string) error {

	if clientID == "" {
		return fmt.Errorf("el DNI del cliente no puede estar vacio")
	}
	if name == "" {
		return fmt.Errorf("el nombre del cliente no puede estar vacio")
	}

	existing, err := ctx.GetStub().GetState("client~" + clientID)
	if err != nil {
		return fmt.Errorf("error leyendo state: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("el cliente %s ya existe", clientID)
	}

	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSPID: %v", err)
	}

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("error obteniendo timestamp: %v", err)
	}
	createdAt := time.Unix(txTimestamp.Seconds, 0).Format(time.RFC3339)

	client := Client{
		DocType:      "client",
		ClientID:     clientID,
		Name:         name,
		Balance:      0,
		RegisteredBy: mspID,
		CreatedAt:    createdAt,
	}
	clientJSON, err := json.Marshal(client)
	if err != nil {
		return err
	}

	ctx.GetStub().SetEvent("ClientRegistered", []byte(
		fmt.Sprintf(`{"clientID":"%s","name":"%s","registeredBy":"%s"}`,
			clientID, name, mspID)))

	return ctx.GetStub().PutState("client~"+clientID, clientJSON)
}

// Mint emite puntos a un cliente. Solo puede llamarlo HotelMSP.
func (s *SmartContract) Mint(ctx contractapi.TransactionContextInterface,
	clientID string, amount int, description string) error {

	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSPID: %v", err)
	}
	if mspID != "HotelMSP" {
		return fmt.Errorf("solo el hotel puede emitir puntos (caller: %s)", mspID)
	}

	if amount <= 0 {
		return fmt.Errorf("la cantidad debe ser positiva")
	}

	client, err := s.getClient(ctx, clientID)
	if err != nil {
		return err
	}

	client.Balance += amount
	clientJSON, err := json.Marshal(client)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState("client~"+clientID, clientJSON); err != nil {
		return err
	}

	tokenInfo, err := s.getTokenInfo(ctx)
	if err != nil {
		return err
	}
	tokenInfo.TotalSupply += amount
	tokenJSON, err := json.Marshal(tokenInfo)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState("tokenInfo", tokenJSON); err != nil {
		return err
	}

	txID := ctx.GetStub().GetTxID()
	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()
	ts := time.Unix(txTimestamp.Seconds, 0).Format(time.RFC3339)

	tx := Transaction{
		DocType:     "transaction",
		TxID:        txID,
		ClientID:    clientID,
		TxType:      "mint",
		Amount:      amount,
		Description: description,
		Org:         mspID,
		Timestamp:   ts,
	}
	txJSON, err := json.Marshal(tx)
	if err != nil {
		return err
	}

	txKey, err := ctx.GetStub().CreateCompositeKey("tx", []string{clientID, txID})
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState(txKey, txJSON); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("PointsMinted", []byte(
		fmt.Sprintf(`{"clientID":"%s","amount":%d,"description":"%s","newBalance":%d}`,
			clientID, amount, description, client.Balance)))

	return nil
}

// Redeem canjea puntos de un cliente por un producto. Solo CafeteriaMSP.
func (s *SmartContract) Redeem(ctx contractapi.TransactionContextInterface,
	clientID string, amount int, product string) error {

	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSPID: %v", err)
	}
	if mspID != "CafeteriaMSP" {
		return fmt.Errorf("solo la cafeteria puede canjear puntos (caller: %s)", mspID)
	}

	if amount <= 0 {
		return fmt.Errorf("la cantidad debe ser positiva")
	}

	client, err := s.getClient(ctx, clientID)
	if err != nil {
		return err
	}

	if client.Balance < amount {
		return fmt.Errorf("saldo insuficiente: tiene %d puntos, necesita %d",
			client.Balance, amount)
	}

	client.Balance -= amount
	clientJSON, err := json.Marshal(client)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState("client~"+clientID, clientJSON); err != nil {
		return err
	}

	tokenInfo, err := s.getTokenInfo(ctx)
	if err != nil {
		return err
	}
	tokenInfo.TotalRedeemed += amount
	tokenJSON, err := json.Marshal(tokenInfo)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState("tokenInfo", tokenJSON); err != nil {
		return err
	}

	txID := ctx.GetStub().GetTxID()
	txTimestamp, _ := ctx.GetStub().GetTxTimestamp()
	ts := time.Unix(txTimestamp.Seconds, 0).Format(time.RFC3339)

	tx := Transaction{
		DocType:     "transaction",
		TxID:        txID,
		ClientID:    clientID,
		TxType:      "redeem",
		Amount:      amount,
		Description: product,
		Org:         mspID,
		Timestamp:   ts,
	}
	txJSON, err := json.Marshal(tx)
	if err != nil {
		return err
	}

	txKey, err := ctx.GetStub().CreateCompositeKey("tx", []string{clientID, txID})
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState(txKey, txJSON); err != nil {
		return err
	}

	ctx.GetStub().SetEvent("PointsRedeemed", []byte(
		fmt.Sprintf(`{"clientID":"%s","amount":%d,"product":"%s","newBalance":%d}`,
			clientID, amount, product, client.Balance)))

	return nil
}

// BalanceOf devuelve el saldo de puntos de un cliente
func (s *SmartContract) BalanceOf(ctx contractapi.TransactionContextInterface,
	clientID string) (int, error) {

	client, err := s.getClient(ctx, clientID)
	if err != nil {
		return 0, err
	}
	return client.Balance, nil
}

// ClientHistory devuelve todas las transacciones de un cliente
func (s *SmartContract) ClientHistory(ctx contractapi.TransactionContextInterface,
	clientID string) ([]*Transaction, error) {

	_, err := s.getClient(ctx, clientID)
	if err != nil {
		return nil, err
	}

	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey("tx",
		[]string{clientID})
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var transactions []*Transaction
	for iterator.HasNext() {
		result, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		var tx Transaction
		if err := json.Unmarshal(result.Value, &tx); err != nil {
			return nil, err
		}
		transactions = append(transactions, &tx)
	}
	return transactions, nil
}

// GetTokenInfo devuelve la informacion global del token
func (s *SmartContract) GetTokenInfo(ctx contractapi.TransactionContextInterface) (*TokenInfo, error) {
	return s.getTokenInfo(ctx)
}

// GetAllClients devuelve todos los clientes registrados
func (s *SmartContract) GetAllClients(ctx contractapi.TransactionContextInterface) ([]*Client, error) {
	queryString := `{"selector":{"docType":"client"}}`
	iterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var clients []*Client
	for iterator.HasNext() {
		result, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		var client Client
		if err := json.Unmarshal(result.Value, &client); err != nil {
			return nil, err
		}
		clients = append(clients, &client)
	}
	return clients, nil
}

// --- Funciones auxiliares ---

func (s *SmartContract) getClient(ctx contractapi.TransactionContextInterface,
	clientID string) (*Client, error) {

	clientJSON, err := ctx.GetStub().GetState("client~" + clientID)
	if err != nil {
		return nil, fmt.Errorf("error leyendo cliente: %v", err)
	}
	if clientJSON == nil {
		return nil, fmt.Errorf("el cliente %s no existe", clientID)
	}
	var client Client
	if err := json.Unmarshal(clientJSON, &client); err != nil {
		return nil, err
	}
	return &client, nil
}

func (s *SmartContract) getTokenInfo(ctx contractapi.TransactionContextInterface) (*TokenInfo, error) {
	tokenJSON, err := ctx.GetStub().GetState("tokenInfo")
	if err != nil {
		return nil, err
	}
	if tokenJSON == nil {
		return nil, fmt.Errorf("token no inicializado, ejecuta InitLedger primero")
	}
	var tokenInfo TokenInfo
	if err := json.Unmarshal(tokenJSON, &tokenInfo); err != nil {
		return nil, err
	}
	return &tokenInfo, nil
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
