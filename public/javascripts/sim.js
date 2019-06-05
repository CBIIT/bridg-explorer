// dep: $ = jquery
var d3 = require('d3')
var $ = require('jquery')

function set_parms(sim,conf) {
  if (sim.force('center')) {
    sim.force('center')
      .x(conf.wid/2)
    sim.force('center')
      .y(conf.ht/2)
  }
  sim.force('charge')
    .strength(conf.charge)
    .distanceMax(2*conf.node_bnd)
  sim.force('links')
    .distance(conf.link_dist)
    .strength(conf.link_strength)
  sim.force('collision')
    .radius(conf.node_bnd)
  sim.alphaTarget(conf.alphaTarget)
}

function create_sim(data,svg_container,conf) {
  var svg = $(svg_container)
  conf.wid = svg.width()
  conf.ht = svg.height()
  console.log(conf)
  svg.attr("viewBox",[0,0,conf.wid,conf.ht])
  var nodes = data.nodes.map(d => Object.create(d))
  var links = data.links.map(d => Object.create(d))
  sim = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody())
    .force('links', d3.forceLink(links).id( d => d.id))
    .force('center', d3.forceCenter())
    .force('collision', d3.forceCollide())
  set_parms(sim,conf)
  return sim
}  

function draw_sim(sim,svg_container,conf,...annotArgs) {
  var svg=d3.select(svg_container)
  var _annot_func, _annot_args
  [_annot_func, ..._annot_args] = annotArgs
  // func, args = annotArgs...
  // if annotArgs is empty, ignore  
  var links_r = svg
      .append("g")
      .selectAll("line")
      .data(sim.force("links").links())
      .join("line")
      .attr("class","link");
  var nodes_r = svg
      .append("g")
      .selectAll("circle")
      .data(sim.nodes())
      .join("circle")
      .attr("class","node")
      .attr("r", conf.node_r)
      .call(drag(sim,conf))
      .on("dblclick", (d, i) => { d.fx = d.fy = null })
  nodes_r.append("title")
    .text( d => d.title )
  nodes_r
    .call( _annot_func ? _annot_func : d => d, _annot_args ) 
  sim.on("tick", () => {
    nodes_r
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
    links_r
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)
  })
}

drag = (simulation,conf) => {
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

exports.create_sim = create_sim
exports.set_parms = set_parms
exports.draw_sim = draw_sim

