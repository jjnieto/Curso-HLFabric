package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ProductoContract gestiona el registro y la trazabilidad de productos.
type ProductoContract struct {
	contractapi.Contract
}

type Producto struct {
	DocType           string `json:"docType"`
	NumeroSerie       string `json:"numeroSerie"`
	Modelo            string `json:"modelo"`
	Lote              string `json:"lote"`
	FechaFabricacion  string `json:"fechaFabricacion"`
	PropietarioActual string `json:"propietarioActual"`
	Estado            string `json:"estado"`
}

type TransferenciaCustodia struct {
	DocType     string `json:"docType"`
	NumeroSerie string `json:"numeroSerie"`
	Origen      string `json:"origen"`
	Destino     string `json:"destino"`
	Fecha       string `json:"fecha"`
	TxID        string `json:"txID"`
}

// RegistrarProducto crea un producto nuevo. Solo FabricanteMSP puede invocarlo.
func (c *ProductoContract) RegistrarProducto(ctx contractapi.TransactionContextInterface, numeroSerie, modelo, lote string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}
	if mspID != "FabricanteMSP" {
		return fmt.Errorf("solo FabricanteMSP puede registrar productos, no %s", mspID)
	}

	existing, err := ctx.GetStub().GetState(numeroSerie)
	if err != nil {
		return fmt.Errorf("error consultando el estado: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("el producto %s ya existe", numeroSerie)
	}

	producto := Producto{
		DocType:           "producto",
		NumeroSerie:       numeroSerie,
		Modelo:            modelo,
		Lote:              lote,
		FechaFabricacion:  time.Now().Format(time.RFC3339),
		PropietarioActual: mspID,
		Estado:            "REGISTRADO",
	}

	data, err := json.Marshal(producto)
	if err != nil {
		return fmt.Errorf("error serializando el producto: %v", err)
	}
	if err := ctx.GetStub().PutState(numeroSerie, data); err != nil {
		return fmt.Errorf("error guardando el producto: %v", err)
	}

	ctx.GetStub().SetEvent("ProductoRegistrado", data)
	return nil
}

// TransferirCustodia transfiere la custodia del producto al destino indicado.
// Solo el propietario actual puede invocarlo.
func (c *ProductoContract) TransferirCustodia(ctx contractapi.TransactionContextInterface, numeroSerie, destino string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}

	data, err := ctx.GetStub().GetState(numeroSerie)
	if err != nil {
		return fmt.Errorf("error consultando el producto: %v", err)
	}
	if data == nil {
		return fmt.Errorf("el producto %s no existe", numeroSerie)
	}

	var producto Producto
	if err := json.Unmarshal(data, &producto); err != nil {
		return fmt.Errorf("error deserializando: %v", err)
	}
	if producto.PropietarioActual != mspID {
		return fmt.Errorf("solo el propietario actual (%s) puede transferir, no %s", producto.PropietarioActual, mspID)
	}

	transferencia := TransferenciaCustodia{
		DocType:     "transferencia",
		NumeroSerie: numeroSerie,
		Origen:      mspID,
		Destino:     destino,
		Fecha:       time.Now().Format(time.RFC3339),
		TxID:        ctx.GetStub().GetTxID(),
	}
	txData, err := json.Marshal(transferencia)
	if err != nil {
		return fmt.Errorf("error serializando la transferencia: %v", err)
	}
	txKey, err := ctx.GetStub().CreateCompositeKey("transferencia", []string{numeroSerie, ctx.GetStub().GetTxID()})
	if err != nil {
		return fmt.Errorf("error creando composite key: %v", err)
	}
	if err := ctx.GetStub().PutState(txKey, txData); err != nil {
		return fmt.Errorf("error guardando la transferencia: %v", err)
	}

	producto.PropietarioActual = destino
	producto.Estado = "EN_TRANSITO"
	updatedData, err := json.Marshal(producto)
	if err != nil {
		return fmt.Errorf("error serializando: %v", err)
	}
	if err := ctx.GetStub().PutState(numeroSerie, updatedData); err != nil {
		return fmt.Errorf("error actualizando el producto: %v", err)
	}

	ctx.GetStub().SetEvent("CustodiaTransferida", txData)
	return nil
}

// ListarProductos devuelve todos los productos registrados en el canal.
// Usa CouchDB rich query filtrando por docType para no incluir las
// claves compuestas de transferencias.
func (c *ProductoContract) ListarProductos(ctx contractapi.TransactionContextInterface) ([]*Producto, error) {
	queryString := `{"selector":{"docType":"producto"}}`
	iterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("error listando productos: %v", err)
	}
	defer iterator.Close()

	var productos []*Producto
	for iterator.HasNext() {
		result, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterando productos: %v", err)
		}
		var p Producto
		if err := json.Unmarshal(result.Value, &p); err != nil {
			return nil, fmt.Errorf("error deserializando producto: %v", err)
		}
		productos = append(productos, &p)
	}
	return productos, nil
}

// ConsultarProducto devuelve el estado actual del producto.
func (c *ProductoContract) ConsultarProducto(ctx contractapi.TransactionContextInterface, numeroSerie string) (*Producto, error) {
	data, err := ctx.GetStub().GetState(numeroSerie)
	if err != nil {
		return nil, fmt.Errorf("error consultando el producto: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("el producto %s no existe", numeroSerie)
	}

	var producto Producto
	if err := json.Unmarshal(data, &producto); err != nil {
		return nil, fmt.Errorf("error deserializando: %v", err)
	}
	return &producto, nil
}

// VerificarAutenticidad devuelve el historial completo de custodia del producto.
func (c *ProductoContract) VerificarAutenticidad(ctx contractapi.TransactionContextInterface, numeroSerie string) ([]*TransferenciaCustodia, error) {
	exists, err := ctx.GetStub().GetState(numeroSerie)
	if err != nil {
		return nil, fmt.Errorf("error consultando: %v", err)
	}
	if exists == nil {
		return nil, fmt.Errorf("el producto %s no existe", numeroSerie)
	}

	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey("transferencia", []string{numeroSerie})
	if err != nil {
		return nil, fmt.Errorf("error consultando transferencias: %v", err)
	}
	defer iterator.Close()

	var transferencias []*TransferenciaCustodia
	for iterator.HasNext() {
		result, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterando: %v", err)
		}
		var tx TransferenciaCustodia
		if err := json.Unmarshal(result.Value, &tx); err != nil {
			return nil, fmt.Errorf("error deserializando transferencia: %v", err)
		}
		transferencias = append(transferencias, &tx)
	}
	return transferencias, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&ProductoContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creando el chaincode cc-producto: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error arrancando el chaincode cc-producto: %v", err))
	}
}
