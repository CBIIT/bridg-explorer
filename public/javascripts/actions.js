var _ = require('lodash');
var api = require('./neo4jApi');
var $ = require('jquery');
var d3 = require('d3');
var d3api = require('./d3api');

// init the page:
$(function () {
  //  renderGraph();
  // entSearch();

  $("#ent-search").submit(e => {
    e.preventDefault();
    entSearch(e.target);
  });
  $("#doc-search").submit(e => {
    e.preventDefault();
    entSearch(e.target);
  });
  
});

function entSearch(e) {
  var query = $(e).find("input[name=search]").val();
  var minscore = _.toNumber($(e).find("input[name=matchmin]").val());
  var stmtKey = $(e).attr('id').match(/^[a-z]{3}/)[0];
  api
    .searchEnts(query,minscore,stmtKey)
    .then(entities => {
      var t = $("table#results tbody").empty();
      if (entities) {
        entities.forEach(ent => {
	  if (ent == null) { console.log("ent is null") }
          else {
            var r = $("<tr>"+
                      "<td class='entity' data-entity-id='"+ent.id+"'>"+
                      ent.name + "</td><td>" +
	              ent.ent + "</td>" +
                      "<td class='entity' data-entity-id='"+ent.owning_class_id+"'>"+
	              (ent.owning_class ? ent.owning_class : "N/A") + "</td><td>" +
	              ent.doc + "</td><td>" +
	              ent.score + "</td></tr>").appendTo(t)
            r.find("td.entity").click(function () {
              showEnt($(this).attr('data-entity-id'))
              // showNeighbors($(this).attr('data-entity-id') )
              showAncestors($(this).attr('data-entity-id') )
            })
            
	  }
        });
      }
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
      $("<ul>"+"<li>"+ent.definition+"</li><li>"+ent.examples+"</li>"+
        (ent.notes ? "<li>"+ent.notes+"</li>" : "")).appendTo($("#node_display"))
    }, "json");
}


function showNeighbors(cls_id) {
  var width = 350, height = 320;
  $("#graph_display").empty()
  api
    .getNeighbors(cls_id)
      .then(graph => {
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
        d3api.renderSimulation("#graph_display",graph, width, height)
        d3.select("#graph_display")
          .selectAll(".node")
          .on("click", (d) => showEnt(d.id))

      })
}


