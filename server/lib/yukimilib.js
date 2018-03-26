Array.prototype.remove = function (items) {
    for (let item of arguments) {
        const index = this.indexOf(item);
        if (index !== -1) {
            this.splice(index, 1);
        }
    }
    return this.length;
};

module.exports = {

};