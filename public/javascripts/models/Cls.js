var _ = require('lodash');

// function Cls(_node) {
//     _.extend(this, _node.properties);
// }

function Cls(_obj) {
    _.extend(this, _obj);
}
module.exports = Cls;
