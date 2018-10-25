import * as AssetGraph from './AssetGraph'

function getTransitionRate(...transitions: AssetGraph.ITransition[]): number{
  let rate = 1;
  for (let transition of transitions) {
    let transitionRate: number;
    if(transition.sell.asset === transition.marketPair.market){
      transitionRate = transition.marketPair.askPrice || transition.marketPair.basePrice;
    }else{
      transitionRate = 1 / ( transition.marketPair.bidPrice || transition.marketPair.basePrice );
    }
    rate *= transitionRate * (1 - 0.0025);
  }
  return rate;
}

export interface IArbitrageSignal {
  rate: number;
  transitions: AssetGraph.ITransition[];
}

export function getArbitrageTriangleSignals(graph: AssetGraph.Graph, baseAssetSymbol: string, timeoutMs = 500): IArbitrageSignal[]{
  var timeExhausted = false;
  setTimeout(() => { timeExhausted = true }, timeoutMs)
  const signals: IArbitrageSignal[] = [];
  const baseVertex = graph.getVertexByAsset({symbol: baseAssetSymbol});
  if(!baseVertex) throw new Error(`Asset not in the graph!`);
  baseVertex.getTransitions().forEach((firstOrderTransition) => {
    if (timeExhausted) return;
    firstOrderTransition.buy.getTransitions().forEach((secondOrderTransition) => {
      if (timeExhausted) return;
      if (secondOrderTransition.buy === firstOrderTransition.sell) return;
      secondOrderTransition.buy.getTransitions().forEach((thirdOrderTransition) => {
        if (timeExhausted) return;
        if (thirdOrderTransition.buy !== baseVertex) return;
        // if not profitable also return
        // generate signal
        let rate = getTransitionRate(firstOrderTransition, secondOrderTransition, thirdOrderTransition);
        if(rate > 1.01){
          signals.push({
            rate,
            transitions: [firstOrderTransition, secondOrderTransition, thirdOrderTransition],
          })
        }
      })
    })
  })
  return signals;
}


