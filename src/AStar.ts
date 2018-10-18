import {GraphNode, GraphEdge, Path, PathSegment} from './AssetGraph'

function reconstructPath(start: GraphNode, end: GraphNode, cameFrom: Map<GraphNode, GraphNode>): Path{
  var current = end;
  var path: Path = [];
  while(cameFrom.has(current)){
    const from = cameFrom.get(current)!;
    //TODO: camefrom save edges
    const to = current;
    current = from;
    var exchangeRate: number;
    const via = from.edges.find((edge) => {
      return edge.baseAsset === to || edge.marketAsset === to
    })
    if(!via) throw new Error("impossible yo");
    if(via.marketAsset === to){
      exchangeRate = 1/via.price;
    }else{
      exchangeRate = via.price;
    }
    path.unshift({from, to, exchangeRate});
    if(current === start) break;
  }
  return path;
}

export default function AStar(start: GraphNode, end: GraphNode): Path {
  const closedSet: GraphNode[] = [];
  const openSet: GraphNode[] = [start];
  const cameFrom = new Map<GraphNode, GraphNode>();
  const gScore = new Map<GraphNode, number>();
  const fScore = new Map<GraphNode, number>();
  fScore.set(start, 1);

  while( openSet.length > 0 ){
    //current := the node in openSet having the lowest fScore[] value
    const openSetFScores = openSet.map((node) => fScore.get(node) || Infinity);
    const current = openSet[openSetFScores.indexOf(Math.min(...openSetFScores))];
      
    if(current === end){
      return reconstructPath(start, end, cameFrom);
    }

    openSet.splice(openSet.indexOf(current), 1);
    closedSet.push(current);

    for (let neighbor of current.neigbors){
      if(closedSet.indexOf(neighbor) > 0) continue;
      const tentative_gScore = (gScore.get(current) || Infinity) + 1;

      if(openSet.indexOf(neighbor) < 0){
        openSet.push(neighbor)
      }else if(tentative_gScore > (gScore.get(neighbor) || Infinity)){
        continue;
      }

      cameFrom.set(neighbor, current);
      gScore.set(neighbor, tentative_gScore);
      fScore.set(neighbor, (gScore.get(neighbor) || Infinity) + 1);
    }
  }

  return [];
}






