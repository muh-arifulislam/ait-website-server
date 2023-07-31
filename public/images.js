const fs = require("fs");
const path = require("path");

module.exports = (req, res) => {
  const imageName = req.query.name; // The image name will be passed as a query parameter
  const imagePath = path.join(__dirname, "../public/images/", imageName);

  fs.readFile(imagePath, (err, data) => {
    if (err) {
      res.status(404).json({ error: "Image not found" });
    } else {
      res.setHeader("Content-Type", "image/jpeg"); // Set the correct Content-Type for the image
      res.send(data);
    }
  });
};
