module.exports = function requireFile(
  name,
  label = null,
  customMessage = null
) {
  return (req, res, next) => {
    req.requiredFilesInfo = req.requiredFilesInfo || new Map();

    req.requiredFilesInfo.set(name, {
      name,
      label: label || name,
      customMessage: customMessage || null,
    });

    next();
  };
};
