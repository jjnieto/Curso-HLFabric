# Carga las variables de entorno necesarias para los scripts.
# Uso:  source env.sh    (desde mayoristas/solucion/)
#
# Después de hacer source, tendrás:
#   - peer, configtxgen, osnadmin, fabric-ca-client en el PATH
#   - FABRIC_CFG_PATH apuntando al config/ de Fabric (donde vive core.yaml)

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

if [ -d "$SCRIPT_DIR/bin" ]; then
    export PATH="$SCRIPT_DIR/bin:$PATH"
fi

if [ -f "$SCRIPT_DIR/config/core.yaml" ]; then
    export FABRIC_CFG_PATH="$SCRIPT_DIR/config"
fi

# Comprobación rápida
if command -v peer >/dev/null 2>&1; then
    echo "OK: peer disponible -> $(which peer)"
    echo "    FABRIC_CFG_PATH=$FABRIC_CFG_PATH"
else
    echo "WARN: 'peer' no está en el PATH. ¿Has ejecutado install-fabric.sh en este directorio?"
fi
