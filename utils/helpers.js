const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatGPA = (gpa) => {
  if (gpa === null || gpa === undefined) return null;
  return parseFloat(gpa).toFixed(2);
};

module.exports = { formatDate, formatGPA };
