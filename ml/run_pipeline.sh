#!/bin/bash
# ML Pipeline — Data Collection → Feature Engineering → Training → Prediction Server
# Usage: ./run_pipeline.sh [full|update|train|predict|server]

set -e
cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  AlgoKing ML Pipeline${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

# Install dependencies if needed
if ! python3 -c "import xgboost" 2>/dev/null; then
    echo -e "${GREEN}[Setup] Installing ML dependencies...${NC}"
    pip3 install -r requirements.txt
fi

CMD=${1:-full}

case $CMD in
    full)
        echo -e "\n${GREEN}[1/4] Collecting 5yr historical data...${NC}"
        python3 data_collector.py full

        echo -e "\n${GREEN}[2/4] Computing 87 features for all symbols...${NC}"
        python3 features.py all

        echo -e "\n${GREEN}[3/4] Training XGBoost + LightGBM (walk-forward validation)...${NC}"
        python3 train.py full

        echo -e "\n${GREEN}[4/4] Starting prediction server on port 5055...${NC}"
        python3 server.py --live 60
        ;;
    update)
        echo -e "\n${GREEN}[1/2] Incremental data update...${NC}"
        python3 data_collector.py update

        echo -e "\n${GREEN}[2/2] Regenerating predictions...${NC}"
        python3 train.py predict
        ;;
    train)
        echo -e "\n${GREEN}Training models...${NC}"
        python3 train.py full
        ;;
    predict)
        echo -e "\n${GREEN}Generating predictions...${NC}"
        python3 train.py predict
        ;;
    server)
        echo -e "\n${GREEN}Starting prediction server on port 5055...${NC}"
        python3 server.py --live ${2:-60}
        ;;
    status)
        python3 data_collector.py status
        ;;
    *)
        echo "Usage: ./run_pipeline.sh [full|update|train|predict|server|status]"
        echo ""
        echo "  full    — Complete pipeline: collect data → train → start server"
        echo "  update  — Incremental data update + regenerate predictions"
        echo "  train   — Retrain models on existing data"
        echo "  predict — Generate predictions with current model"
        echo "  server  — Start prediction API server (port 5055)"
        echo "  status  — Show database statistics"
        ;;
esac
