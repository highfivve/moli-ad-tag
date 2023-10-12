module.exports = function (value) {
  return new Date(value).toLocaleDateString('de-DE', {year: 'numeric', month: '2-digit', day:'2-digit'});
};
