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

const isLoggedIn = (req, res, err) => {
	if (!req.session.loggedin) {
		res.status(401).end(err);
		return false;
	}
	if (!req.session.email) {
		res.status(500).end('Internal Server Error');
		return false;
	}
	return true
}

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

const ex_query = (
	sql,
	errCallback = (err, _) => {
		console.log(err);
		return;
	}, succCallback = (_, result) => {
		console.log(strify(result)); // REMOVE
	}) => {
	conn.query(sql, (err, result) => {
		if (err) {
			errCallback(err, null);
		}
		succCallback(null, result);
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
			req.session.userid = result[0].id;
			res.status(200).end('Logged in');
			return;
		}
		res.status(401).end('Incorrect email or password')
	});
})

app.post('/new-survey', function (req, res) {
	const errormsg = 'Please login to create a survey';
	if (!isLoggedIn(req, res, errormsg)) return;

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
				return;
			}
			res.status(200).end(strify(result));
		});
	})
})

app.get('/survey-:id', function (req, res) {
	const id = req.params.id;
	exec_query(`SELECT public, creator_id FROM surveys WHERE id = ${id}`, (err, result) => {
		if (err) {
			res.status(500).end('Internal Server Error');
			return;
		}
		if (result.length === 0) {
			res.status(404).end('Survey not found')
			return;
		}
		const public = result[0].public;
		if (!public) {
			if (!isLoggedIn(req, res, 'This survey has restricted access, login is required')) return;
			const email = req.session.email;
			const userid = req.session.userid;
			const creatorid = result[0].creator_id;
			if (userid === creatorid) {
				fetchSurvey(id, res);
				return;
			}
			ex_query(`SELECT * FROM survey_access WHERE user_id = ${userid} AND survey_id = ${id}`, undefined, succCallback = (_, result) => {
				if (result.length === 0) {
					res.status(401).end('Your account doesn\'t have access to this survey');
					return;
				}
				fetchSurvey(id, res);
			});
		} else {
			fetchSurvey(id, res);
		}
	});
})

app.post('/share-survey/:id/:userid', function (req, res) {
	if (!isLoggedIn(req, res, 'This action can only be performed from authenticated accounts')) return;
	const id = req.params.id;
	ex_query(`SELECT public, creator_id FROM surveys WHERE id = ${id}`, undefined, (_, result) => {
		if (result.length === 0) {
			res.status(404).end('Survey not found')
			return;
		}
		const public = result[0].public;
		if (public) {
			res.status(409).end('This survey is public and can already be accessed by everyone');
			return;
		}
		const sharerid = req.session.userid;
		const creatorid = result[0].creator_id;
		const receiverid = req.params.userid;
		if (sharerid !== creatorid) {
			res.status(401).end('Only the creator of a survey has permission to share it with others');
			return;
		}
		if (sharerid === receiverid) {
			res.status(409).end('The creator of a survey already has access to it');
			return;
		}
		ex_query(`SELECT * FROM survey_access WHERE user_id = ${receiverid} AND survey_id = ${id}`, undefined, succCallback = (_, result) => {
			if (result.length > 0) {
				res.status(409).end('This account already has access to the survey');
				return;
			}
			ex_query(`INSERT INTO survey_access (user_id, survey_id) VALUES (${receiverid}, ${id})`)
		});
	});
})

const fetchSurvey = (id, res) => {
	ex_query(`SELECT * FROM surveys WHERE id = ${id}`, undefined, (_, result) => {
		const survey = {
			heading: result[0].heading,
			description: result[0].description
		}
		res.status(200).json(survey);
		res.end()
	})
}

app.get('/all-surveys', function (req, res) {
	exec_query("SELECT * FROM surveys", (err, result) => {
		if (err) {
			res.status(500).end('Internal Server Error');
		} else {
			res.status(200).end(strify(result));
		}
	});
})

/*
updateSurvey visibility
UPDATE surveys SET public = 0 WHERE id = <survey_id>;
*/

var server = app.listen(8081, function () {
	var port = server.address().port
	console.log("REST API listening at http://localhost:%s", port)
})
