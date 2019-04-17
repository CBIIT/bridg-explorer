var _ = require('lodash');

// function Prop(_node) {
//     _.extend(this, _node.properties);
// }

function Prop(_obj) {
    _.extend(this, _obj);
}

module.exports = Prop;
