var d3 = require('d3')
var $ = require('jquery')

function Graph(data, sim_conf, svg_container) {
  this.data = data
  this.svg_jq = $(svg_container)
  this.svg_d3 = d3.selection(svg_container) 
  if (!conf.wid && !conf.ht) {
    conf.wid = this.svg_jq.width()
    conf.ht = this.svg_jq.height()
  }
  this.conf = sim_conf
  this.sim = null

  function set_parms(conf) {
    this.conf = conf
    if (this.sim) { // apply config
      if (this.sim.force('center')) {
        this.sim.force('center')
          .x(conf.wid/2)
        this.sim.force('center')
          .y(conf.ht/2)
      }
      this.sim.force('charge')
        .strength(conf.charge)
        .distanceMax(2*conf.node_bnd)
      this.sim.force('links')
        .distance(conf.link_dist)
        .strength(conf.link_strength)
      this.sim.force('collision')
        .radius(conf.node_bnd)
      this.sim.alphaTarget(conf.alphaTarget)
    }
  }
  
  function create_sim() {
    if (!this.conf || !this.conf.node_r) {
      return
    }
    console.log(conf)
    svg.attr("viewBox",[0,0,conf.wid,conf.ht])
    var nodes = data.nodes.map(d => Object.create(d))
    var links = data.links.map(d => Object.create(d))
    this.sim = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody())
      .force('links', d3.forceLink(links).id( d => d.id))
      .force('center', d3.forceCenter())
      .force('collision', d3.forceCollide())
    this.set_parms(conf)
    return sim
  }  
  
  function draw_sim(...annotArgs) {
    if (!this.sim) {
      return
    }
    var _annot_func, _annot_args
    [_annot_func, ..._annot_args] = annotArgs
    // func, args = annotArgs...
    // if annotArgs is empty, ignore  
    var links_r = this.svg_d3
        .append("g")
        .selectAll("line")
        .data(this.sim.force("links").links())
        .join("line")
        .attr("class","link");
    var nodes_r = this.svg_d3
        .append("g")
        .selectAll("circle")
        .data(this.sim.nodes())
        .join("circle")
        .attr("class","node")
        .attr("r", this.conf.node_r)
        .call(drag(this.sim,this.conf))
        .on("dblclick", (d, i) => { d.fx = d.fy = null })
    var nodelbl_r = this.svg_d3
        .append("g")
        .selectAll("text")
        .data(this.sim.nodes())
        .join("text")
        .attr("class", "node_lbl")
        .attr("x", d => d.x-this.conf.node_r/2)
        .attr("y", d => d.y+this.conf.node_r/2)
        .text(d => d.title)
        .call(drag(this.sim,this.conf))
    nodes_r.append("title")
      .text( d => d.title )
    nodes_r
      .call( _annot_func ? _annot_func : d => d, _annot_args ) 
    sim.on("tick", () => {
      nodes_r
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
      nodelbl_r
        .attr("x", d=>d.x-this.conf.node_r/2)
        .attr("y", d=>d.y+this.conf.node_r/2)
      links_r
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y)
    })
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
  }
}

exports.Graph = Graph
