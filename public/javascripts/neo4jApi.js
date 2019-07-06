var neo4j = require('neo4j-driver').v1;
var Cls = require('./models/Cls');
var Prop = require('./models/Prop');
var Entity = require('./models/Entity');
var _ = require('lodash');

var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "j4oen"));

var cypherq = {
  ent: 'CALL db.index.fulltext.queryNodes("ftClassPropertyIndex", $qry) \
             YIELD node as n, score \
             OPTIONAL MATCH (n)<--(d:Documentation) \
             WITH n, d, score \
             OPTIONAL MATCH (c:Class)-[:has_property]->(n) \
             WITH n, d, c, score \
             WHERE score > $minScore \
             RETURN n.name as title, head(labels(n)) as ent, n.id as id, c.name as owning_class, c.id as owning_class_id, d.body as doc, score',
  doc:       'CALL db.index.fulltext.queryNodes("ftDocuIndex", $qry) \
             YIELD node as d, score \
             MATCH (n)<--(d:Documentation) \
             WITH n, d, score \
             OPTIONAL MATCH (c:Class)-[:has_property]->(n) \
             WITH n, d, c, score \
             WHERE score > $minScore \
             RETURN n.name as title, head(labels(n)) as ent, n.id as id, c.name as owning_class, c.id as owning_class_id, d.body as doc, score'
}

function searchEnts(queryString, minScore,stmtKey) {
  var session = driver.session();
  return session
    .run(
      cypherq[stmtKey],
      { minScore: minScore,qry:queryString}
    )
    .then(result => {
      session.close();
      return result.records.map(record => {
	return new Entity(record.toObject());
      });
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getEntity(ent_id) {
  var session = driver.session();
  return session
    .run(
      "MATCH (e {id:$id})<--(d:Documentation) \
             RETURN e.name as title, e.id as id, head(labels(e)) as ent, d.body as doc",
      {id:ent_id}
    )
    .then(result => {
      session.close();
      if (_.isEmpty(result.records))
	return null;
      var record = result.records[0];
      return new Entity(record.toObject());
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getProperties(cls_id) {
  var session = driver.session();
  return session
    .run(
      "MATCH (c:Class {id:$id})-[:has_property]->(p:Property) \
       WITH c, p \
       OPTIONAL MATCH (c), (p)<--(d:Documentation) \
       RETURN c.name as owning_class, c.id as owning_class_id, \
       head(labels(p)) as ent, p.name as title, p.id as id, d.body as doc",
      {id:cls_id}
    )
    .then(result => {
      session.close();
      if (_.isEmpty(result.records))
	return null;
      var nodes = []
      result.records.forEach(
        rec => { nodes.push(new Entity(rec.toObject())) }
      )
      return nodes
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getAncestors(cls_id) {
  var session = driver.session();
  return session
    .run(
      "MATCH p = (c:Class {id: $id})-[:is_a*]->(u:Class {name:$urclass}) \
       RETURN nodes(p) as p",
      {id:cls_id,
       urclass: 'UrClass'}
    )
    .then(result => {
      session.close();
      if (_.isEmpty(result.records))
	return null;
      var res = result.records[0].get('p');
      var nodes = [], links = [], i;
      nodes.push({ title: res[0].properties.name, ent:'Class',
                   id: res[0].properties.id })
      for (i=1; i<_.size(res); i=i+1) {
        nodes.push({ title: res[i].properties.name, ent:'Class',
                     id: res[i].properties.id })
        links.push({source:res[i-1].properties.id, target:res[i].properties.id,
                    id:res[i-1].properties.id+"_"+res[i].properties.id});
      }
      return {nodes, links};
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getClassContext(prop_id) {
  var session = driver.session();
  return session
    .run( // distal
      'MATCH p = (c:Class {id: $prop_id})<-[:is_a*]-(r:Class) return \
[x in nodes(p) | { title:x.name, id:x.id, ent:"Class" }] as pth',
      {prop_id:prop_id}
    )
    .then(results => {
      var graph = {nodes:[], links:[]}
      //    session.close();
      if (_.isEmpty(results)) 
        return nodes
      results.records.forEach( res => {
        var pth = res.get('pth')
        graph.nodes = _.unionBy(graph.nodes,[pth[0]],'id')
        for (var i=1; i<_.size(pth);i++) {
          graph.nodes = _.unionBy(graph.nodes,[pth[i]],'id')
          graph.links.push( {target: pth[i-1].id, source: pth[i].id, type:"is_a",
                             id: pth[i].id+"_"+pth[i-1].id+"_is_a"} )
        }
      })
      return graph
    })
    .then(
      graph => {
        return session.run( // proximal
          'MATCH p = (c:Class {id: $prop_id})-[:is_a*]->(r:Class {name:$urclass}) return \
[x in nodes(p) | { title:x.name, id:x.id, ent:"Class" }] as pth',
          {prop_id:prop_id,urclass:"UrClass"}
        ).then(results => {
          session.close();
          if (!_.isEmpty(results)) {
            results.records.forEach( res => {
              var pth = res.get('pth')
              graph.nodes = _.unionBy(graph.nodes,[pth[0]],'id')
              for (var i=1; i<_.size(pth);i++) {
                graph.nodes = _.unionBy(graph.nodes,[pth[i]],'id')
                graph.links.push( {source: pth[i-1].id,target: pth[i].id,type:"is_a",
                             id: pth[i-1].id+"_"+pth[i].id+"_is_a"} )
              }
            })
          }
          return graph
        })
          .catch( err => { console.log("AGGGH", err) })
      }
    )
    .catch( err => { console.log("Barfed in getClassContext: ",err) } )
}
function getClassAndSibs(prop_id) {
  var session = driver.session();
  var cypher_q = 'MATCH (p:Property {id: $prop_id})<-[:has_property]-(c:Class) OPTIONAL MATCH (c)-[:has_property]->(s:Property) WHERE s.id <> $prop_id WITH c,p,collect(s) as ls RETURN c.name as cls_name, c.id as cls_id, [ [p.name, p.id] ]+[s in ls | [s.name, s.id]] as props'
  return session.run(
    cypher_q, {prop_id:prop_id})
    .then(results => {
      session.close();
      if (_.isEmpty(results))
        return null
      var nodes = [], links = []
      var res = results.records[0];
      if (_.isEmpty(res))
        return null
      nodes.push( { title: res.get('cls_name'), ent:'Class',
                    id: res.get('cls_id')} )
      res.get('props').forEach( prop => {
        nodes.push( { title: prop[0], ent:'Property',
                      id: prop[1] }) })
      nodes.forEach( n => {
        if (n.ent=='Property') links.push({source:nodes[0].id, target:n.id,
                                           id:nodes[0].id+"_"+n.id+"_has_prop",
                                           type:"has_prop"})
      })
      return {nodes, links};
    })
    .catch( err => { console.log("Barfed in getClassAndSibs: ",err) })
}

function getNeighbors(cls_id) {
  var session = driver.session();
  return session.run(
    'MATCH (c:Class {id:$cls_id})-[r]-(n:Class) \
     WITH startNode(r) as c, endNode(r) as n, r \
     RETURN c.name as src_name, c.id as src_id, type(r) as rtype, \
            n.name as tgt_name, n.id as tgt_id',
    {cls_id:cls_id})
    .then(results => {
      session.close();
      var nodes = [], links = [], i = 0;
      results.records.forEach(res => {
        var src_node = { title: res.get('src_name'), ent:'Class',
                         id: res.get('src_id') }
        var tgt_node = { title: res.get('tgt_name'), ent:'Class',
                         id: res.get('tgt_id') }
        var source = _.findIndex(nodes, src_node)
        if (source == -1) {
          nodes.push(src_node)
          source = i
          i++
        }
        var target = _.findIndex(nodes, tgt_node)
        if (target == -1) {
          nodes.push(tgt_node)
          target = i
          i++
        }
        links.push({source, target, type:res.get('rtype'),
                    id: source+"_"+target+"_"+res.get('rtype')});
      });
      return {nodes, links};
    })
    .catch( err => { console.log("Barfed in get Neighbors: ",err) });
}

function getAssocs(cls_id, outgoing) {
  var session = driver.session();
  var cypher_q = {
    outg: 'MATCH (c:Class {id:$cls_id})-[r]->(d:Class) \
           WHERE exists(r.src_role) \
           RETURN c.name as src_name, c.id as src_id, type(r) as rtype, \
            r.src_role as src_role, r.dst_role as dst_role, \
            d.name as dst_name, d.id as dst_id',
    incm: 'MATCH (c:Class {id:$cls_id})<-[r]-(d:Class) \
           WHERE exists(r.src_role) \
           RETURN c.name as dst_name, c.id as dst_id, type(r) as rtype, \
            r.src_role as src_role, r.dst_role as dst_role, \
            d.name as src_name, d.id as src_id'
  }
  return session.run(
    outgoing ? cypher_q.outg : cypher_q.incm, {cls_id:cls_id})
    .then( results => {
      session.close();
      if (_.isEmpty(results))
        return []
      var assocs = []
      results.records.forEach( res => {
        assocs.push( {
          src : { title: res.get('src_name'), id: res.get('src_id'), ent:'Class', role: res.get('src_role')},
          dst : { title: res.get('dst_name'), id: res.get('dst_id'), ent:'Class', role: res.get('dst_role')},
          rtype : res.get('rtype'),
          id: res.get('src_id')+"_"+res.get('dst_id')+"_"+res.get('rtype')
        })
      })
      return assocs;
    })
    .catch( err => { console.error("Barfed in getAssocs: ",err) });
}

function getPropsAsAssocs(cls_id) {
  var session = driver.session()
  var cypher_q = "MATCH (c:Class {id: $cls_id})-[:has_property]->(p:Property) \
                  RETURN c.name as cls_name, c.id as cls_id, p.name as prop_name, p.id as prop_id"

  return session.run(
    cypher_q, {cls_id:cls_id})
    .then( results => {
      session.close();
      if (_.isEmpty(results))
        return []
      var assocs=[]
      results.records.forEach( res => {
        assocs.push( {
          src : { title: res.get('cls_name'), id: res.get("cls_id"), ent:'Class', role: 'class' },
          dst : { title: res.get('prop_name'), id: res.get("prop_id"), ent:'Property', role: 'property'},
          rtype : 'has_property',
          id: res.get('cls_id')+"_"+res.get('prop_id')+"_has_property"
        })
      })
      return assocs
    })
    .catch( err => { console.error("Barfed in getPropsAsAssocs: ",err) })
}

function getAncestorAsAssoc(cls_id)  {
  var session = driver.session()
  var cypher_q = "MATCH (s:Class {id: $cls_id})-[:is_a]->(d:Class) \
                  RETURN d.name as dst_name, d.id as dst_id, s.name as src_name, s.id as src_id"

  return session.run(
    cypher_q, {cls_id:cls_id})
    .then( results => {
      session.close();
      if (_.isEmpty(results))
        return []
      var assocs=[]
      results.records.forEach( res => {
        if (res.get("dst_name") != 'UrClass') {
          assocs.push( {
            src : { title: res.get('src_name'), id: res.get("src_id"), ent:'Class', role: 'child' },
            dst : { title: res.get('dst_name'), id: res.get("dst_id"), ent:'Class', role: 'parent'},
            rtype : 'is_a',
            id: res.get('src_id')+"_"+res.get('dst_id')+"_is_a_as_assoc"
          })
        }
      })
      return assocs
    })
    .catch( err => { console.error("Barfed in getPropsAsAssocs: ",err) })
}

exports.getAssocs = getAssocs;
exports.getNeighbors = getNeighbors;
exports.searchEnts = searchEnts;
exports.getEntity = getEntity;
exports.getProperties = getProperties;
exports.getAncestors = getAncestors;
exports.getClassAndSibs = getClassAndSibs;
exports.getClassContext = getClassContext;
exports.getPropsAsAssocs = getPropsAsAssocs;
exports.getAncestorAsAssoc = getAncestorAsAssoc;
