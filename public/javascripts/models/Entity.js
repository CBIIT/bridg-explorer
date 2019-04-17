var _ = require('lodash');
var def_re = /(DEFINITION:(?:.|\n)*?)(?:[A-Z() ]{4,}:|$)/
var eg_re = /(EXAMPLE.S.:(?:.|\n)*?)(?:[A-Z() ]{4,}:|$)/
var other_re = /(OTHER.NAME.S.:(?:.|\n)*?)(?:[A-Z() ]{4,}:|$)/
var notes_re = /(NOTE.S.:(?:.|\n)*?)(?:[A-Z() ]{4,}:|$)/

function Entity(_obj) {
  _.extend(this, _obj);
  if (this.doc) {
    this.doc.match(def_re) &&
      (this.definition = this.doc.match(def_re)[1] || 'N/A')
    this.doc.match(eg_re) &&
      (this.examples = this.doc.match(eg_re)[1] || 'N/A')
    this.doc.match(other_re) &&
      (this.other_names = this.doc.match(other_re)[1] || 'N/A')
    this.doc.match(notes_re) &&
      (this.notes = this.doc.match(notes_re)[1] || 'N/A')
  }
  this
}
module.exports = Entity;
