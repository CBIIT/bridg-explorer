var _ = require('lodash');

function Doc(_node) {
    _.extend(this, _node.properties);
}

module.exports = Doc;
