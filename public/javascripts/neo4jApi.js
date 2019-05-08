//require('../../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js');
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
             RETURN n.name as name, head(labels(n)) as ent, n.id as id, c.name as owning_class, c.id as owning_class_id, d.body as doc, score',
  doc:       'CALL db.index.fulltext.queryNodes("ftDocuIndex", $qry) \
             YIELD node as d, score \
             MATCH (n)<--(d:Documentation) \
             WITH n, d, score \
             OPTIONAL MATCH (c:Class)-[:has_property]->(n) \
             WITH n, d, c, score \
             WHERE score > $minScore \
             RETURN n.name as name, head(labels(n)) as ent, n.id as id, c.name as owning_class, c.id as owning_class_id, d.body as doc, score'
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
             RETURN e.name as name, e.id as id, head(labels(e)) as ent, d.body as doc",
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
       head(labels(p)) as ent, p.name as name, p.id as id, d.body as doc",
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
      nodes.push({ title: res[0].properties.name, label:'Class',
                   id: res[0].properties.id })
      for (i=1; i<_.size(res); i=i+1) {
        nodes.push({ title: res[i].properties.name, label:'Class',
                     id: res[i].properties.id })
        links.push({source:i-1, target:i});
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
[x in nodes(p) | { title:x.name, id:x.id, label:"Class" }] as pth',
      {prop_id:prop_id}
    )
    .then(results => {
      var nodes = [], links = []
      //    session.close();
      if (_.isEmpty(results)) 
        return null
      results.records.forEach( res => {
        var pth = res.get('pth');
        var i;
        for (i=1; i < _.size(pth); i=i+1) {
          var tgt = _.findIndex(nodes, pth[i-1])
          var src = _.findIndex(nodes, pth[i])
          if (tgt == -1) {
            nodes.push(pth[i-1])
            tgt = _.size(nodes)-1
          }
          if (src == -1) {
            nodes.push(pth[i])
            src = _.size(nodes)-1
          }
          var link = {source:src, target:tgt, type:"is_a"}
          if (_.findIndex(links,link) == -1) {
            links.push(link)
          }
        }
      })
      console.log("hey")
      console.log({nodes, links})
      return {nodes, links}
    })
    .then(
      nl => {
        return session.run( // proximal
          'MATCH p = (c:Class {id: $prop_id})-[:is_a*]->(r:Class {name:$urclass}) return \
[x in nodes(p) | { title:x.name, id:x.id, label:"Class" }] as pth',
          {prop_id:prop_id,urclass:"UrClass"}
        ).then(results => {
          session.close();
          var nodes = [], links = []
          if (_.isEmpty(results))
            return {nodes, links}
          results.records.forEach( res => {
            var pth = res.get('pth');
            var i;
            for (i=1; i < _.size(pth); i=i+1) {
              var src = _.findIndex(nodes, pth[i-1])
              var tgt = _.findIndex(nodes, pth[i])
              if (tgt == -1) {
                nodes.push(pth[i-1])
                tgt = _.size(nodes)-1
              }
              if (src == -1) {
                nodes.push(pth[i])
                src = _.size(nodes)-1
              }
              var link = {source:src, target:tgt, type:"is_a"}
              if (_.findIndex(links,link) == -1) {
                links.push(link)
              }
            }
          })
          nodes.push(nl.nodes)
          links.push(nl.links)
          return {nodes:nodes.flat(),links:links.flat()}
        })
          .catch( err => { console.log("AGGGH", err) })
      }
    )
    .catch( err => { console.log("Dude, I barfed.",err) } )
}
function getClassAndSibs(prop_id) {
  var session = driver.session();
  return session.run(
    'MATCH (p:Property {id: $prop_id})<-[:has_property]-(c:Class)-[:has_property]->(s:Property) WITH c,p,collect(s) as ls RETURN c.name as cls_name, c.id as cls_id, [ [p.name, p.id] ]+[s in ls | [s.name, s.id]] as props',
    {prop_id:prop_id})
    .then(results => {
      session.close();
      if (_.isEmpty(results))
        return null
      var nodes = [], links = []
      var res = results.records[0];
      nodes.push( { title: res.get('cls_name'), label:'Class',
                    id: res.get('cls_id')} )
      res.get('props').forEach( prop => {
        nodes.push( { title: prop[0], label:'Property',
                      id: prop[1] }) })
      var i;
      for ( i=1; i < _.size(nodes); i=i+1) {
        links.push({source:0, target:i});
      }
      return {nodes, links};
    });
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
        var src_node = { title: res.get('src_name'), label:'Class',
                         id: res.get('src_id') }
        var tgt_node = { title: res.get('tgt_name'), label:'Class',
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
        links.push({source, target, type:res.get('rtype')});
      });
      return {nodes, links};
    });
}

exports.getNeighbors = getNeighbors;
exports.searchEnts = searchEnts;
exports.getEntity = getEntity;
exports.getProperties = getProperties;
exports.getAncestors = getAncestors;
exports.getClassAndSibs = getClassAndSibs;
exports.getClassContext = getClassContext;
