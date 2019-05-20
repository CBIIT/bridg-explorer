var d3 = require('d3');
var conf = {
  node_r: 10,
  node_bnd: 25,
  charge: 20,
  link_dist: 30,
  link_strength:0.2,
  alphaTarget: 0.1
}
function renderGraph(container, nodes, links, sim, node_id) {
  var svg = d3.select(container)
      .append('svg')
      .attr('class', 'graph')
      .attr("width", "250%").attr("height", "250%")
      .attr('pointer-events', 'all')
  // lay down the links
  svg.selectAll('.link')
    .data(links)
    .enter()
    .append('line')
    .attr('class','link')
    .attr('title',d => {return d.type})

  // create the groups first, and load each with the circle
  svg.selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('id',d => {return d.id})
    .attr('data-entity-id', d => { return d.id })
    .attr('class', d => {return "node "+ d.label + (d.title == "UrClass" ? " ur"  : "") + (d.id == node_id ? " hilite" : " no_hilite" )})
    .append('circle')
    .attr('r', conf.node_r)
    .attr('cx', d => { return d.x })
    .attr('cy', d => { return d.y })
  
  // come back and add the text labels, each within its group
  svg.selectAll('.node')
    .data(nodes)
    .join(
      enter => {return},
      update => {
        update
          .append('text')
          .attr("class", "node_lbl")
          .attr("x",d => {return d.x-(conf.node_r/2)})
          .attr("y",d => {return d.y+(conf.node_r/2)})
          .text(d => {return d.title})
      })

}

function renderSimulation(container,graph,width,height,node_id) {
  var sim = d3.forceSimulation()
      .force('charge', d3.forceManyBody().strength(conf.charge)
             .distanceMax(2*conf.node_bnd))
      .force('links', d3.forceLink().distance(conf.link_dist)
             .strength(conf.link_strength))
      .force('center', d3.forceCenter(width/2,height/2))
      .force('collision', d3.forceCollide(conf.node_bnd))
  sim.nodes(graph.nodes)
  sim.force('links').links(graph.links)
  renderGraph(container, graph.nodes, graph.links, sim, node_id)
  var node = d3.select(container).selectAll(".node")
  var link  = d3.select(container).selectAll(".link")
  node
    .call(drag(sim))
  sim.on("tick", () => {
    node
      .select("circle")
      .attr("cx", d => { return d.x })
      .attr("cy", d => { return d.y })
    node
      .select("text")
      .attr("x", d => { return d.x })
      .attr("y", d => { return d.y })
    link
      .attr("x1", d => { return d.source.x })
      .attr("y1", d => { return d.source.y })
      .attr("x2", d => { return d.target.x })
      .attr("y2", d => { return d.target.y })

  });
  
}

function drag(simulation){
  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(conf.alphaTarget).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }
  
  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }
  
  return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
}

exports.renderSimulation = renderSimulation

