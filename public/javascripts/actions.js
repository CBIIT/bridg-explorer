var _ = require('lodash');
var api = require('./neo4jApi');
var $ = require('jquery');
var d3 = require('d3');
var d3api = require('./d3api');

// init the page:
$(function () {
  //  renderGraph();
  // entSearch();

  $("#ent-search-btn").on("click",e => {
    e.preventDefault();
    entSearch(e.target,"ent");
  });
  $("#doc-search-btn").on("click",e => {
    e.preventDefault();
    entSearch(e.target,"doc");
  });
  
});

function entSearch(e, stmtKey) {
  var query = $("#query-inp").val();
  var minscore = _.toNumber($("#match-score-inp").val());
  console.log(e, query, minscore, stmtKey)
  api
    .searchEnts(query,minscore,stmtKey)
    .then(entities => {
      if (_.isEmpty(entities))
          return null
      var t = $("table#results tbody").empty();
      entities.forEach(ent => {
	if (ent == null) { console.log("ent is null") }
        else {
          var r = $("<tr>"+
                    "<td class='entity' data-entity-id='"+ent.id+"' data-entity-type='"+ent.ent+"'>"+
                    ent.name + "<button class='dismiss-row'>X</button></td><td>" +
	            ent.ent + "</td>" +
                    "<td class='entity' data-entity-id='"+ent.owning_class_id+"' data-entity-type='Class'>"+
	            (ent.owning_class ? ent.owning_class : "N/A") + "</td><td>" +
	            ent.doc + "</td><td>" +
	            ent.score + "</td></tr>").appendTo(t)
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
                $("<ul><strong>"+prop.name+"</strong><li>"+prop.definition+"</li><li>"+
                  prop.examples+"</li>"+
                  (_.size(prop.notes) ? "<li>"+prop.notes+"</li>" : "")+"</ul>")
                  .appendTo($("#node_display"))
              })
          })
        $("</ul>").appendTo($("#node_display"))
      }
    },"json")
}


function showNeighbors(cls_id) {
  var width = 350, height = 320;
  $("#graph_display").empty()
  api
    .getNeighbors(cls_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      d3api.renderSimulation("#graph_display",graph, width, height)
      d3.select("#graph_display")
        .selectAll(".node")
        .on("click", (d) => showEnt(d.id))
    })
}

function showAncestors(cls_id) {
  var width = 350, height = 320;
  $("#graph_display").empty()
  api
    .getAncestors(cls_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      d3api.renderSimulation("#graph_display",graph, width, height)
      d3.select("#graph_display")
        .selectAll(".node")
        .on("click", (d) => showEnt(d.id))
      
    })
}

function showClassAndSibs(prop_id) {
  var width = 350, height = 320;
  $("#graph_display").empty()
  api
    .getClassAndSibs(prop_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      d3api.renderSimulation("#graph_display",graph, width, height)
      d3.select("#graph_display")
        .selectAll(".node")
        .on("click", (d) => showEnt(d.id))
      
    })
}


