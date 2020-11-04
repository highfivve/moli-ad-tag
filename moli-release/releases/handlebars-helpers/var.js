module.exports = function (name, value) {
  console.log(name, value);
  this[name] = value;
};
