var _ = require('lodash');
var api = require('./neo4jApi');
var $ = require('jquery');
var d3 = require('d3');
var d3api = require('./d3api');

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
  console.log(e, query, minscore, stmtKey)
  api
    .searchEnts(query,minscore,stmtKey)
    .then(entities => {
      if (_.isEmpty(entities)) {
        $("table#results tbody").empty();
        return null
      }
      var t = $("table#results tbody").empty();
      entities.forEach(ent => {
	if (ent == null) { console.log("ent is null") }
        else {
          var r = $("<tr>"+
                    "<td class='entity' data-entity-id='"+ent.id+"' data-entity-type='"+ent.ent+"'>"+
                    "<input type='checkbox' name='keep-me'/>"+
                    ent.name+
                    "<button class='dismiss-row'>X</button>"+
                    ( ent.ent == 'Class' ?
                      "<button class='src-assoc'>Src Assoc</button>"+
                      "<button class='dst-assoc'>Dst Assoc</button></td>" :
                      "" ) +
                    "<td>"+ent.ent+"</td>"+
                    "<td class='entity' data-entity-id='"+ent.owning_class_id+"' data-entity-type='Class'>"+
	            (ent.owning_class ? ent.owning_class : "N/A")+"</td>"+
                    "<td>"+ent.doc+"</td>"+
                    "<td>"+ent.score+"</td>"+
                    "</tr>").appendTo(t)
          r.find("[type=checkbox]").click(
            e => { e.stopPropagation() }
          )
          r.find("button.src-assoc").click(
            function (e) {
              e.stopPropagation();
              console.log(e.target.closest("td"))
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

function showAssoc(cls_id, outgoing) {
  api
    .getAssocs(cls_id,outgoing)
    .then( assocs => {
      if (_.isEmpty(assocs)) {
        return null
      }
      var t = $("table#assocs")
      assocs.forEach( assoc => {
        if (assoc == null) console.log("assoc is null")
        else {
          var r = $("<tr>"+
                    "<td class='entity source' data-entity-id='"+assoc.src.id+"' data-entity-type='Class'>"+
                    "<input type='checkbox' name='keep-me'/>"+
                    +assoc.src.title+
                    "<button class='dismiss-row'>X</button>"+
                    "<button class='src-assoc'>Src Assoc</button>"+
                    "<button class='dst-assoc'>Dst Assoc</button>"+
                    "</td>"+
                    "<td class='entity source role'>"+assoc.src.role+"</td>"+
                    "<td class='assoc'>"+assoc.rtype+"</td>"+
                    "<td class='entity dest role'>"+assoc.dst.role+"</td>"+
                    "<td class='entity dest' data-entity-id='"+assoc.dst.id+"' data-entity-type='Class'>"+assoc.dst.title+
                    "<button class='src-assoc'>Src Assoc</button>"+
                    "<button class='dst-assoc'>Dst Assoc</button>"+
                    "</td>"+
                    "</tr>").appendTo(t)
          r.find("[type=checkbox]").click(
            e => { e.stopPropagation() }
          )
          r.find("button.src-assoc").click(
            function (e) {
              e.stopPropagation();
              console.log(e.target.closest("td"))
              showAssoc($(e.target.closest("td")).attr('data-entity-id'), 1); } )
          r.find("button.dst-assoc").click(
            function (e) {
              e.stopPropagation();
              showAssoc($(e.target.closest("td")).attr('data-entity-id'), 0); } )
          r.find("button.dismiss-row").click(
            e => {
              e.stopPropagation();
              e.target.closest("tr").remove(); } )
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
      })
    })
    .catch( err => { console.log("Barfed in showAssoc", err) })
}

function showNeighbors(cls_id) {
  var width = 350, height = 320;
  $("#graph_display").empty()
  api
    .getNeighbors(cls_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      d3api.renderSimulation("#graph_display",graph, width, height,cls_id)
      d3.select("#graph_display")
        .selectAll(".node")
        .on("click", (d) => showEnt(d.id))
    })
}

function showAncestors(cls_id) {
  var width = 350, height = 320;
  $("#graph_display").empty()
  api
  //    .getAncestors(cls_id)
    .getClassContext(cls_id)
    .then(graph => {
      if (_.isEmpty(graph))
        return null
      d3api.renderSimulation("#graph_display",graph, width, height,cls_id)
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
      d3api.renderSimulation("#graph_display",graph, width, height,prop_id)
      d3.select("#graph_display")
        .selectAll(".node")
        .on("click", (d) => showEnt(d.id))
      
    })
}

function clearTable(table) {
  $(table+" tbody > tr > td > input[type=checkbox]:not(:checked)")
    .closest("tr")
    .remove()
}

