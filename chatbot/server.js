const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// Open index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Optional: handle all HTML pages
app.get("/:page", (req, res, next) => {
    const file = path.join(__dirname, `${req.params.page}.html`);

    res.sendFile(file, err => {
        if (err) {
            next();
        }
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`MarkStreet running on port ${PORT}`);
});
