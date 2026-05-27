package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PedidoContract gestiona el ciclo de vida de pedidos entre dos organizaciones.
// Se despliega en canal-mayorista (Fabricante↔Mayorista) y en canal-minorista
// (Mayorista↔Minorista) con el mismo código pero distintas políticas de endoso.
type PedidoContract struct {
	contractapi.Contract
}

type Pedido struct {
	DocType            string        `json:"docType"`
	ID                 string        `json:"id"`
	Comprador          string        `json:"comprador"`
	Vendedor           string        `json:"vendedor"`
	Lineas             []LineaPedido `json:"lineas"`
	Estado             string        `json:"estado"`
	Tracking           string        `json:"tracking"`
	FechaCreacion      string        `json:"fechaCreacion"`
	FechaActualizacion string        `json:"fechaActualizacion"`
}

type LineaPedido struct {
	Producto string  `json:"producto"`
	Cantidad int     `json:"cantidad"`
	Precio   float64 `json:"precio"`
}

// CrearPedido crea un nuevo pedido. El invocante queda registrado como comprador.
func (c *PedidoContract) CrearPedido(ctx contractapi.TransactionContextInterface, pedidoID, lineasJSON string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}

	existing, err := ctx.GetStub().GetState(pedidoID)
	if err != nil {
		return fmt.Errorf("error consultando: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("el pedido %s ya existe", pedidoID)
	}

	var lineas []LineaPedido
	if err := json.Unmarshal([]byte(lineasJSON), &lineas); err != nil {
		return fmt.Errorf("error parseando las líneas del pedido: %v", err)
	}
	if len(lineas) == 0 {
		return fmt.Errorf("el pedido debe tener al menos una línea")
	}

	now := time.Now().Format(time.RFC3339)
	pedido := Pedido{
		DocType:            "pedido",
		ID:                 pedidoID,
		Comprador:          mspID,
		Lineas:             lineas,
		Estado:             "CREADO",
		FechaCreacion:      now,
		FechaActualizacion: now,
	}

	data, err := json.Marshal(pedido)
	if err != nil {
		return fmt.Errorf("error serializando: %v", err)
	}
	if err := ctx.GetStub().PutState(pedidoID, data); err != nil {
		return fmt.Errorf("error guardando: %v", err)
	}

	ctx.GetStub().SetEvent("PedidoCreado", data)
	return nil
}

// AceptarPedido confirma un pedido. Solo puede invocarlo la parte contraria al comprador.
func (c *PedidoContract) AceptarPedido(ctx contractapi.TransactionContextInterface, pedidoID string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}

	pedido, err := c.getPedido(ctx, pedidoID)
	if err != nil {
		return err
	}
	if pedido.Estado != "CREADO" {
		return fmt.Errorf("el pedido no está en estado CREADO (estado: %s)", pedido.Estado)
	}
	if pedido.Comprador == mspID {
		return fmt.Errorf("el comprador no puede aceptar su propio pedido")
	}

	pedido.Vendedor = mspID
	pedido.Estado = "ACEPTADO"
	pedido.FechaActualizacion = time.Now().Format(time.RFC3339)
	return c.savePedido(ctx, pedido, "PedidoAceptado")
}

// RegistrarEnvio registra los datos de envío. Solo el vendedor puede invocarlo.
func (c *PedidoContract) RegistrarEnvio(ctx contractapi.TransactionContextInterface, pedidoID, tracking string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}

	pedido, err := c.getPedido(ctx, pedidoID)
	if err != nil {
		return err
	}
	if pedido.Estado != "ACEPTADO" {
		return fmt.Errorf("el pedido no está en estado ACEPTADO (estado: %s)", pedido.Estado)
	}
	if pedido.Vendedor != mspID {
		return fmt.Errorf("solo el vendedor (%s) puede registrar el envío, no %s", pedido.Vendedor, mspID)
	}

	pedido.Estado = "ENVIADO"
	pedido.Tracking = tracking
	pedido.FechaActualizacion = time.Now().Format(time.RFC3339)
	return c.savePedido(ctx, pedido, "EnvioRegistrado")
}

// ConfirmarRecepcion confirma que el comprador ha recibido la mercancía.
func (c *PedidoContract) ConfirmarRecepcion(ctx contractapi.TransactionContextInterface, pedidoID string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("error obteniendo MSP ID: %v", err)
	}

	pedido, err := c.getPedido(ctx, pedidoID)
	if err != nil {
		return err
	}
	if pedido.Estado != "ENVIADO" {
		return fmt.Errorf("el pedido no está en estado ENVIADO (estado: %s)", pedido.Estado)
	}
	if pedido.Comprador != mspID {
		return fmt.Errorf("solo el comprador (%s) puede confirmar la recepción, no %s", pedido.Comprador, mspID)
	}

	pedido.Estado = "RECIBIDO"
	pedido.FechaActualizacion = time.Now().Format(time.RFC3339)
	return c.savePedido(ctx, pedido, "RecepcionConfirmada")
}

// ConsultarPedido devuelve el estado actual del pedido.
func (c *PedidoContract) ConsultarPedido(ctx contractapi.TransactionContextInterface, pedidoID string) (*Pedido, error) {
	return c.getPedido(ctx, pedidoID)
}

func (c *PedidoContract) getPedido(ctx contractapi.TransactionContextInterface, pedidoID string) (*Pedido, error) {
	data, err := ctx.GetStub().GetState(pedidoID)
	if err != nil {
		return nil, fmt.Errorf("error consultando: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("el pedido %s no existe", pedidoID)
	}
	var pedido Pedido
	if err := json.Unmarshal(data, &pedido); err != nil {
		return nil, fmt.Errorf("error deserializando: %v", err)
	}
	return &pedido, nil
}

func (c *PedidoContract) savePedido(ctx contractapi.TransactionContextInterface, pedido *Pedido, eventName string) error {
	data, err := json.Marshal(pedido)
	if err != nil {
		return fmt.Errorf("error serializando: %v", err)
	}
	if err := ctx.GetStub().PutState(pedido.ID, data); err != nil {
		return fmt.Errorf("error guardando: %v", err)
	}
	ctx.GetStub().SetEvent(eventName, data)
	return nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&PedidoContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creando el chaincode cc-pedido: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error arrancando el chaincode cc-pedido: %v", err))
	}
}
