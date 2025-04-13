import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book_notes",
  password: "#Mr.Hacker248009",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM books ORDER BY COALESCE(date_read, '1970-01-01') DESC;");
        res.render("index", { books: result.rows});
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching books");
    }
});

app.get("/add", (req, res) => {
    res.render("add", { error: req.query.error });
});



app.post("/add", async (req, res) => {
    let { title, author, rating, cover_url, date_read, review } = req.body;

    // Set current date if empty
    if (!date_read || date_read.trim() === "") {
        const today = new Date();
        date_read = today.toISOString().split("T")[0]; // 'YYYY-MM-DD'
    }

    // Fetch cover_url if empty
    if (!cover_url || cover_url.trim() === "") {
        try {
            const response = await axios.get(
                `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
            );
            const data = response.data;

            if (data.docs.length > 0) {
                const book = data.docs[0];
                title = book.title;
                author = book.author_name[0];
                if (book.isbn && book.isbn.length > 0) {
                    cover_url = `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-s.jpg`;
                } else if (book.cover_i) {
                    cover_url = `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`;
                } else {
                    cover_url = "/default-cover.jpg"; // fallback
                }
            } else {
                cover_url = "/default-cover.jpg"; // fallback
            }
        } catch (err) {
            console.error("Cover fetch error:", err);
            cover_url = "/default-cover.jpg"; // fallback on error
        }
    }

    try {
        await db.query(
            "INSERT INTO books (title, author, rating, cover_url, date_read, review) VALUES ($1, $2, $3, $4, $5, $6);",
            [title, author, parseInt(rating), cover_url, date_read, review]
        );
        res.redirect("/");
    } catch (err) {
            if (err.code === "23505") {
                return res.redirect("/add?error=duplicate");
        
        } else {
            console.error("Database error:", err);
            res.status(500).send("Error adding book.");
        }
    }
});


app.get("/edit/:id", async (req, res) => {
    const bookId = req.params.id;
    try {
        const result = await db.query("SELECT * FROM books WHERE id = $1;", [bookId]);
        if (result.rows.length === 0) {
            return res.status(404).send("Book not found");
        }
        res.render("edit", { book: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching book details");
    }
});

app.post("/update/:id", async (req, res) => {
    const bookId = req.params.id;
    let { title, author, rating, cover_url, date_read, review } = req.body;

    try {
        if (!date_read) {
            const result = await db.query("SELECT date_read FROM books WHERE id=$1;", [bookId]);
            date_read = result.rows[0].date_read; // Preserve the existing date
        }

        await db.query(
            "UPDATE books SET title=$1, author=$2, rating=$3, cover_url=$4, date_read=$5, review=$6 WHERE id=$7;",
            [title, author, parseInt(rating), cover_url, date_read, review, bookId]
        );
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating book");
    }
});


app.post("/delete/:id", async (req, res) => {
    const bookId = req.params.id;

    try {
        await db.query("DELETE FROM books WHERE id = $1;", [bookId]);
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting book");
    }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
