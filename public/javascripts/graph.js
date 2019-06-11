var d3 = require('d3')
var $ = require('jquery')
var _ = require('lodash')
// kludge: hardcoded fontsize in px 10pt ~ 8px
var fsz = 8
function _link_label(d, j) {
  var pl = Math.sqrt((d.source.x-d.target.x)**2 + (d.source.y-d.target.y)**2)
  var tl = (d.type || d.rtype).length * fsz
  var spct = (pl > tl ? (pl - _.toNumber(tl))/2 : 0)

  d3.select(this)
    .append("path")
    .attr("id", "path_"+d.id)
    .attr("stroke","none")
    .attr("fill","none")
    .attr("d", "M"+d.source.x+" "+d.source.y+" L"+d.target.x+" "+d.target.y)
  d3.select(this)
    .append("text")
    .attr("class","link_lbl")
    .append("textPath")
    .attr("startOffset",_.toString(spct))
    .attr("href", "#path_"+d.id)
    .text((d.type || d.rtype)+" >")
}

function _link_label_upd(d, j) {
  var pl = Math.sqrt((d.source.x-d.target.x)**2 + (d.source.y-d.target.y)**2)
  var tl = (d.type || d.rtype).length * fsz
  var spct = (pl > tl ? (pl - _.toNumber(tl))/2 : 0)

  d3.select(this)
    .select("path")
    .attr("d", "M"+d.source.x+" "+d.source.y+" L"+d.target.x+" "+d.target.y)
  d3.select(this)
    .select("textPath")
    .attr("startOffset",_.toString(spct))
  }

function Graph (data, sim_conf, svg_container) {
  this.data = data
  this.svg_jq = $(svg_container)
  this.svg_d3 = d3.select(svg_container) 
  if (!sim_conf.wid && !sim_conf.ht) {
    sim_conf.wid = this.svg_jq.width()
    sim_conf.ht = this.svg_jq.height()
  }
  this.conf = sim_conf
  this.sim = null
  this.set_parms = function (conf) {
    this.conf = conf
    if (this.sim) { // apply config
      this.sim.stop()
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
      this.sim.alphaTarget(conf.alphaTarget).restart()
    }
  }
  
  this._create_sim = function () {
    if (!this.conf || !this.conf.node_r) {
      return
    }
    this.svg_jq.attr("viewBox",[0,0,this.conf.wid,this.conf.ht])
    this.sim_data =
        { nodes: this.data.nodes.map(d => Object.create(d)),
          links: this.data.links.map(d => Object.create(d)) }
    this._force_center = d3.forceCenter()
    
    this.sim = d3.forceSimulation(this.sim_data.nodes)
      .force('charge', d3.forceManyBody())
      .force('links', d3.forceLink(this.sim_data.links).id( d => d.id))
      .force('center', this._force_center)
      .force('collision', d3.forceCollide())
    this.set_parms(this.conf)

    
  }  

  this.draw = function (...annotArgs) {
    if (!this.sim) {
      return
    }
    var _annot_func, _annot_args
    [_annot_func, ..._annot_args] = annotArgs
    // func, args = annotArgs...
    // if annotArgs is empty, ignore
    this.rendered = {}
    this.rendered.links = this.svg_d3
      .append("g")
      .attr("class","links_g")
      .selectAll("line")
      .data(this.sim.force("links").links(), d => d.id  )
      .join("line")
      .attr("class","link");
    this.rendered.nodes = this.svg_d3
      .append("g")
      .attr("class","nodes_g")
      .selectAll("circle")
      .data(this.sim.nodes(), d => d.id)
      .join("circle")
      .attr("class","node")
      .attr("r", this.conf.node_r)
      .call(this._drag())
      .on("dblclick", (d, i) => { d.fx = d.fy = null })
    this.rendered.node_lbls = this.svg_d3
      .append("g")
      .attr("class","node_lbls_g")
      .selectAll("text")
      .data(this.sim.nodes(), d => d.id)
      .join("text")
      .attr("class", "node_lbl")
      .attr("x", d => (d.fx || d.x)-this.conf.node_r/2)
      .attr("y", d => (d.fy || d.y)+this.conf.node_r/2)
      .text(d => d.title)
      .call(this._drag())
    this.rendered.link_lbls = this.svg_d3
      .append("g")
      .attr("class","link_lbls_g")
      .selectAll("g")
      .data(this.sim.force("links").links(), d => d.id)
      .join("g")
      .each( _link_label )


    this.rendered.nodes.append("title")
      .text( d => d.title )
    this.rendered.nodes
      .call( _annot_func ? _annot_func : d => d, _annot_args ) 
    this.sim.on("tick", () => {
      this.rendered.nodes
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
      this.rendered.node_lbls
        .attr("x", d => (d.fx || d.x)-this.conf.node_r/2)
        .attr("y", d => (d.fy || d.y)+this.conf.node_r/2)
      this.rendered.links
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y)
      this.rendered.link_lbls
        .each( _link_label_upd )
//        .select("path")
//        .attr("d", d => "M"+d.source.x+" "+d.source.y+" L"+d.target.x+" "+d.target.y)
     })
  }

  this.join = function (data, ...annotArgs) {
    if (!this.sim) {
      return
    }
    var _annot_func, _annot_args
    [_annot_func, ..._annot_args] = annotArgs
    this.data = data

    var nodes = this.data.nodes.map(d => {
      var i = _.findIndex(this.sim_data.nodes, e => e.id == d.id )
      if (i < 0) {
        d.x = this.conf.wid/2 + 1.414*this.conf.node_r*(Math.random()*2-1)
        d.y = this.conf.ht/2 + 1.414*this.conf.node_r*(Math.random()*2-1)
        return Object.create(d)
      }
      else
        return this.sim_data.nodes[i]
    })
    var links = this.data.links.map(d => {
      var i = _.findIndex(this.sim_data.links, e => e.id == d.id)
      if (i < 0)
        return Object.create(d)
      else
        return this.sim_data.links[i]
    })

    this.sim.nodes(this.sim_data.nodes = nodes)
    this.sim.force('links').links(this.sim_data.links = links)

    this.rendered.links = this.svg_d3
      .select('.links_g')
      .selectAll('.link')
      .data(this.sim.force("links").links(), d => d.id )
      .join(
        enter => enter.append("line")
          .attr("class","link")
          .each( function ( d, i, n ) {
            d3.select(this)
              .attr("x1", d.source.x)
              .attr("y1", d.source.y)
              .attr("x2", d.target.x)
              .attr("y2", d.target.y)
          }),

      )
    this.rendered.nodes = this.svg_d3
      .select('.nodes_g')
      .selectAll('.node')
      .data(this.sim.nodes(), d => d.id  )
      .join(
        enter => enter.append("circle")
          .attr("class","node")
          .attr("r", this.conf.node_r)
          .attr("cx", d => d.x)
          .attr("cy", d => d.y)
          .call(this._drag())
          .on("dblclick", (d, i) => { d.fx = d.fy = null }),
      )
    this.rendered.node_lbls = this.svg_d3
      .select(".node_lbls_g")
      .selectAll("text")
      .data(this.sim.nodes(), d => d.id)
      .join(
        enter => enter.append("text")
          .attr("class", "node_lbl")
          .attr("x", d => d.x-this.conf.node_r/2)
          .attr("y", d => d.y+this.conf.node_r/2)
          .text(d => d.title)
      )
      .call(this._drag())
    this.rendered.link_lbls = this.svg_d3
      .select(".link_lbls_g")
      .selectAll("g")
      .data(this.sim.force("links").links(), d => d.id)
      .join(
        enter => enter.append("g")
          .each( _link_label ),
        update => update.select("g")
          .each( _link_label_upd )
      )
    this.rendered.nodes
      .call( _annot_func ? _annot_func : d => d, _annot_args )
    // this.heat()
  }
  
  this.heat = function () {
    this.sim.stop()
    this.rendered.nodes
      .each( (d,i,n) => {d.fx = d.fy = null } )
    this.sim.alphaTarget(this.conf.alphaTarget).restart()
  }
  this.center_on = function () {
    this.sim.stop()
    this.sim.force('center', this._force_center)
    this.sim.alphaTarget(this.conf.alphaTarget).restart()
  }
  this.center_off = function () {
    this.sim.stop()
    this.sim.force('center', null)
    this.sim.alphaTarget(this.conf.alphaTarget).restart()
  }
  this._drag = function () {
    var obj=this
    function dragstarted(d) {
      if (!d3.event.active) obj.sim.alphaTarget(obj.conf.alphaTarget).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }
    
    function dragended(d) {
      if (!d3.event.active) obj.sim.alphaTarget(0);
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }
    
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
  
  // init
  this._create_sim()
  }

exports.Graph = Graph

