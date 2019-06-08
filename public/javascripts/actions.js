var _ = require('lodash')
var api = require('./neo4jApi')
var $ = require('jquery')
var d3 = require('d3')
// var d3api = require('./d3api')
var sim = require('./sim')

gfact = require('./graph')


var sim_conf = {
  node_r: 10,
  node_bnd: 25,
  charge: -10,
  link_dist: 30,
  link_strength:0.2,
  alphaTarget: 0.03
}

AG = null
assoc_graph = { nodes:[], links:[] }
assoc_list = {}

// init the page:
$(function () {
  $("#ent-search-btn").on("click",e => {
    e.preventDefault()
    entSearch(e.target,"ent")
  })
  $("#doc-search-btn").on("click",e => {
    e.preventDefault()
    entSearch(e.target,"doc")
  })
  $("#node_display_head").on("click", e => {
    e.preventDefault()
    showAncestors($("#node_display_head").attr('data-entity-id')) ||
      showClassAndSibs($("#node_display_head").attr('data-entity-id'))
  })
  $("#result-clean-up").click( e => {
    e.preventDefault()
    clearTable("table#results")
  })
  $("#assoc-clean-up").click( e => {
    e.preventDefault()
    clearTable("table#assocs")
  })
  
});

function entSearch(e, stmtKey) {
  var query = $("#query-inp").val();
  var minscore = _.toNumber($("#match-score-inp").val());
  api
    .searchEnts(query,minscore,stmtKey)
    .then(entities => {
      if (_.isEmpty(entities)) {
        clearTable("table#results")
        return null
      }
      clearTable("table#results")
      var t = $("table#results tbody")
      entities.forEach(ent => {
	if (ent == null) { console.log("ent is null") }
        else {
          var r = $("<tr>"+
                    tdEntity(ent,1)+
                    "<td>"+ent.ent+"</td>"+
                    (ent.owning_class ?
                      tdEntity({title:ent.owning_class, id:ent.owning_class_id,
                               label: "Class"},0) :
                     "<td>N/A</td>")+
                    "<td>"+ent.doc+"</td>"+
                    "<td>"+ent.score.toFixed(2)+"</td>"+
                    "</tr>").appendTo(t)
          r.find("[type=checkbox]").click(
            e => { e.stopPropagation() }
          )
          r.find("button.src-assoc").click(
            function (e) {
              e.stopPropagation();
              showAssoc($(e.target.closest("td")).attr('data-entity-id'), 1); } )
          r.find("button.dst-assoc").click(
            function (e) {
              e.stopPropagation();
              showAssoc($(e.target.closest("td")).attr('data-entity-id'), 0); } )
          r.find("button.dismiss-row").click(
            function (e) {
              e.stopPropagation();
              e.target.closest("tr").remove(); } )
          r.find("td.entity").click(function () {
            showEnt($(this).attr('data-entity-id'))
            // showNeighbors($(this).attr('data-entity-id') )
            switch ($(this).attr('data-entity-type')) {
            case 'Class':
              showAncestors($(this).attr('data-entity-id') )
              break
            case 'Property':
              showClassAndSibs($(this).attr('data-entity-id') )
              break
            default:
              console.error("Unhandled entity type")
            }
          })
            
	}
      });
    });
}


function showEnt(ent_id) {
  api
    .getEntity(ent_id)
    .then(ent => {
      if (!ent) return;
      $("#node_display_head").empty()
      $("#node_display_head").append( $("<b>"+ent.name + " ("+ent.ent+")</b>") )
      $("#node_display_head").attr('data-entity-id',ent_id) 
      $("#node_display").empty()
      $("<em>DOC</em><ul>"+"<li>"+ent.definition+"</li><li>"+ent.examples+"</li>"+
        (_.size(ent.notes) ? "<li>"+ent.notes+"</li>" : "")+"</ul>")
        .appendTo($("#node_display"))
      if (ent.ent == 'Class') {
        $("<em>PROPERTIES</em>").appendTo($("#node_display"))
        api
          .getProperties(ent_id)
          .then( props => {
            if (_.isEmpty(props))
              return null
            props.forEach(
              prop => {
                $('<ul><strong><span class="prop_in_node_disp" data-entity-id="'+prop.id+'">'+prop.name+"</span></strong><li>"+prop.definition+"</li><li>"+
                  prop.examples+"</li>"+
                  (_.size(prop.notes) ? "<li>"+prop.notes+"</li>" : "")+"</ul>")
                  .appendTo($("#node_display"))
                  .find("span")
                  .click( e => {
                    showEnt(prop.id);
                    showClassAndSibs(prop.id);
                  })
              })
          })
        $("</ul>").appendTo($("#node_display"))

      }
    },"json")
    .catch( err => { console.log("Barfed in showEnt", err) })
}

function update_assoc_graph(assoc, remove) {
  var src_n = { title: assoc.src.title || assoc.src.name,
                id: assoc.src.id,
                label: assoc.src.label || assoc.src.ent }
  var tgt_n = { title: assoc.dst.title || assoc.dst.name,
                id: assoc.dst.id,
                label: assoc.dst.label || assoc.dst.ent }
  var link = { source: assoc.src.id, target: assoc.dst.id,
               type: assoc.rtype }
  if (!remove) {
    assoc_graph.nodes = _.unionBy(assoc_graph.nodes, [src_n, tgt_n], 'id')
    assoc_graph.links = _.unionWith(assoc_graph.links, [link],_.isEqual)
  }
  else {
    // remove link
    _.remove(assoc_graph.links, l => _.isEqual(l,link) )
    // remove nodes if nec
    if (!_.some(assoc_graph.links, ['source',link.source]) &&
        !_.some(assoc_graph.links, ['target',link.source])) {
      _.remove(assoc_graph.nodes, (n) => _.isEqual(n.id,link.source))
    }
    if (!_.some(assoc_graph.links, ['source',link.target]) &&
        !_.some(assoc_graph.links, ['target',link.target])) {
      _.remove(assoc_graph.nodes, (n) => _.isEqual(n.id,link.target) )
    }
  }
  if (!AG && _.size(assoc_graph)) { // init graph and render
    AG = new gfact.Graph(assoc_graph, sim_conf, "#ascgraph")
    AG.draw(null,_annotate_nodes,null)
    AG.rendered.nodes
      .on("click", (d) => showEnt(d.id))
    AG.rendered.node_lbls
      .on("click", (d) => showEnt(d.id))
    $("#heat_ascgraph").click( () => {AG.heat()} )
    $("#center_ascgraph").click( () => {AG.center_on()} )
    $("#free_ascgraph").click( () => {AG.center_off()} )      
  }
  else {
    AG.draw(assoc_graph)
  }
  return true
}

function showAssoc(cls_id, outgoing) {
  api
    .getAssocs(cls_id,outgoing)
    .then( assocs => {
      if (_.isEmpty(assocs)) {
        return null
      }
      var t = $("table#assocs")
      assocs.forEach( assoc => {
        if (assoc == null) console.error("assoc is null")
        else {
          var r = $("<tr>"+
                    tdEntity(assoc.src,1) +
                    "<td class='role source'>"+assoc.src.role+"</td>"+
                    "<td class='assoc'>"+assoc.rtype+"</td>"+
                    "<td class='role dest'>"+assoc.dst.role+"</td>"+
                    tdEntity(assoc.dst,0) +
                    "</tr>")
          
          var key = (assoc.src.title||assoc.src.name)+"-"+assoc.src.role+"-"+assoc.rtype+"-"+assoc.dst.role+"-"+(assoc.dst.title||assoc.dst.name)
          if (!assoc_list[key]) {
            r.appendTo(t)
            r.attr("data-assoc-key", key)
            assoc_list[key]=1
            r.find("[type=checkbox]").click(
              e => {
                e.stopPropagation()
                if (e.target.closest("[type=checkbox]").checked) {
                  update_assoc_graph(assoc,0)
                }
                else {
                  update_assoc_graph(assoc,1)
                }
              }
            )
            r.find("button.src-assoc").click(
              function (e) {
                e.stopPropagation()
                showAssoc($(e.target.closest("td")).attr('data-entity-id'), 1) } )
            r.find("button.dst-assoc").click(
              function (e) {
                e.stopPropagation()
                showAssoc($(e.target.closest("td")).attr('data-entity-id'), 0) } )
            r.find("button.dismiss-row").click(
              e => {
                e.stopPropagation()
                var r = e.target.closest("tr")
                delete assoc_list[r.getAttribute("data-assoc-key")]
                update_assoc_graph(assoc,0)
                r.remove(); } )
            r.find("td.entity").click(
              function () {
                showEnt($(this).attr('data-entity-id'))
                // showNeighbors($(this).attr('data-entity-id') )
                switch ($(this).attr('data-entity-type')) {
                case 'Class':
                  showAncestors($(this).attr('data-entity-id') )
                  break
                case 'Property':
                  showClassAndSibs($(this).attr('data-entity-id') )
                  break
                default:
                  console.error("Unhandled entity type")
                }
              })
          }
        }
      })
    })
    .catch( err => { console.log("Barfed in showAssoc", err) })
}

function _annotate_nodes(selection, node_id) {
  selection
    .attr('id',d => d.id)
    .attr('data-entity-id', d => d.id )
    .attr('class', (d) => {return "node "+ d.label + (d.title == "UrClass" ? " ur"  : "") + (d.id == node_id ? " hilite" : " no_hilite" )})
}

function showNeighbors(cls_id) {
  $("#graph").empty()
  api
    .getNeighbors(cls_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      var G = new gfact.Graph(graph,sim_conf,"#graph")
      G.draw(null,_annotate_nodes, cls_id)
      G.rendered.nodes
        .on("click", (d) => showEnt(d.id))
      G.rendered.node_lbls
        .on("click", (d) => showEnt(d.id))
      $("#heat_graph").click( () => {G.heat()} )
      $("#center_graph").click( () => {G.center_on()} )
      $("#free_graph").click( () => {G.center_off()} )      
    })
}

function showAncestors(cls_id) {
  $("#graph").empty()
  $("#heat_graph").off('click')
  $("#center_graph").off('click')
  $("#free_graph").off('click')  
  api
    .getClassContext(cls_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      var G = new gfact.Graph(graph,sim_conf,"#graph")
      G.draw(null,_annotate_nodes, cls_id)
      G.rendered.nodes
        .on("click", (d) => showEnt(d.id))
      G.rendered.node_lbls
        .on("click", (d) => showEnt(d.id))
      $("#heat_graph").click( () => {G.heat()} )
      $("#center_graph").click( () => {G.center_on()} )
      $("#free_graph").click( () => {G.center_off()} )      
      
    })
}

function showClassAndSibs(prop_id) {
  $("#graph").empty()
  $("#heat_graph").off('click')
  api
    .getClassAndSibs(prop_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      var G = new gfact.Graph(graph,sim_conf,"#graph")
      G.draw(null,_annotate_nodes, prop_id)
      G.rendered.nodes
        .on("click", (d) => showEnt(d.id))
      G.rendered.node_lbls
        .on("click", (d) => showEnt(d.id))
      $("#heat_graph").click( () => {G.heat()} )
    })
}

function clearTable(table) {
  $(table+" tbody > tr > td > input[type=checkbox]:not(:checked)")
    .closest("tr")
    .each( (i,r) => {
      delete assoc_list[r.getAttribute("data-assoc-key")]
      // why doesn't $(this) work??????
    })

  $(table+" tbody > tr > td > input[type=checkbox]:not(:checked)")
    .closest("tr")
    .remove()
}

function tdEntity(ent,chk) {
  return "<td class='entity' data-entity-id='"+ent.id+"' data-entity-type='"+
    (ent.label||ent.ent)+
    "'>"+
    (chk ? "<input class='mr-2' type='checkbox' class='keep-me'/>" : "")+
    (ent.title||ent.name)+
    "<p><button type='button' class='btn btn-secondary btn-small mr-1 dismiss-row'>X</button>"+
    ( ent.label == 'Class' || ent.ent == 'Class' ?
      "<button type='button' class='btn btn-secondary btn-small mr-1 src-assoc'>as Src</button>"+
      "<button type='button' class='btn btn-secondary btn-small dst-assoc'>as Dst</button>" : "")+
    "</td>"
}

