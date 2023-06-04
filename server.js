const express = require('express');
const app = express();
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}))


// let reader = {
// 	err: null,
// 	result: null
// }

const conn = mysql.createConnection({
	host: "localhost",
	user: "survey",
	password: "1234",
	database: "survey"
});

conn.connect(function (err) {
	if (err) throw err;
	console.log("Connected!");
})

const strify = (obj) => {
	return require('util').inspect(obj);
}

// const cleanReader = (reader) => {
// 	reader.err = null;
// 	reader.result = null;
// 	return;
// }

const exec_query = (sql, callback) => {
	// cleanReader(reader);
	conn.query(sql, (err, result) => {
		if (err) {
			console.log(err);
			callback(err, null);
			// res.status(500).end('Internal Server Error');
		}
		console.log(strify(result)); // REMOVE
		callback(null, result);
		// res.status(200).end(strify(result));
	})
};

app.post('/register', (req, res) => {
	const { email, password } = req.body;

	let sql = `SELECT * FROM users WHERE email = '${email}'`;
	exec_query(sql, (err, result) => {
		if (err) {
			res.status(500).end('Internal Server Error');
			return;
		}
		if (result.length > 0) {
			res.status(409).end('An account with that email is already registered')
			return;
		}
		sql = `INSERT INTO users (email, password) VALUES ('${email}', '${password}')`;
		exec_query(sql, (err, result) => {
			if (err) {
				res.status(500).end('Internal Server Error');
			} else {
				res.status(200).end(strify(result));
			}
		});
	});
})

app.post('/login', (req, res) => {
	const { email, password } = req.body;

	if (!email || !password) {
		res.status(422).end('Email or password missing');
		return;
	}
	let sql = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
	exec_query(sql, (err, result) => {
		if (err) {
			res.status(500).end('Internal Server Error');
			return;
		}
		if (result.length > 0) {
			req.session.loggedin = true;
			req.session.email = email;
			res.status(200).end('Logged in');
			return;
		}
		res.status(401).end('Incorrect email or password')
	});
})

app.post('/new-survey', function (req, res) {
	if (!req.session.loggedin) {
		res.status(401).end('Please login to create a survey');
		return;
	}
	if (!req.session.email) {
		res.status(500).end('Internal Server Error');
		return;
	}

	let { heading, description = null, public = true } = req.body;
	if (!heading) {
		res.status(422).end('A heading is mandatory to create a survey');
		return;
	}
	heading = mysql.escape(heading)
	description = mysql.escape(description);
	if (!public) public = 0
	else public = 1
	let sql = `SELECT id FROM users WHERE email = '${req.session.email}'`;
	exec_query(sql, (err, result) => {
		if (err || result.length === 0) {
			res.status(500).end('Internal Server Error');
			return;
		}
		const id = result[0].id;
		sql = `INSERT INTO surveys (heading, description, creator_id, public) VALUES (${heading}, ${description}, ${id}, ${public})`;
		exec_query(sql, (err, result) => {
			if (err) {
				res.status(500).end('Internal Server Error');
				return
			}
			res.status(200).end(strify(result));
		});
	})
})

app.get('/all-surveys', function (req, res) {
	exec_query("SELECT * FROM surveys", (err, result) => {
		if (err) {
			res.status(500).end('Internal Server Error');
		} else {
			res.status(200).end(strify(result));
		}
	});
})

var server = app.listen(8081, function () {
	var port = server.address().port
	console.log("REST API listening at http://localhost:%s", port)
})
