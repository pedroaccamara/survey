const express = require('express');
const app = express();
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
const objectHash = require('object-hash');
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

const questionTypes = ['short_question', 'paragraph', 'dropdown', 'multiple_choice', 'single_correct', 'multiple_correct', 'checkboxes', 'linear_scale', 'date', 'time', 'multiple_choice_grid', 'email', 'numeric values'];

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
	res,
	sql,
	errCallback = (err) => {
		console.log(err);
		res.status(500).end('Internal Server Error');
		return;
	}, succCallback = (result) => {
		console.log(strify(result)); // REMOVE
	}) => {
	conn.query(sql, (err, result) => {
		if (err) {
			errCallback(err);
		}
		succCallback(result);
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
	if (!isLoggedIn(req, res, 'Please login to create a survey')) return;

	let { heading, description = null, public = true, questions = [] } = req.body;
	if (!heading) {
		res.status(422).end('A heading is mandatory to create a survey');
		return;
	}
	if (!questions.length) {
		res.status(422).end('Add at least one question to create a survey');
		return;
	}
	heading = mysql.escape(heading)
	description = mysql.escape(description);
	if (!public) public = 0
	else public = 1
	const creatorid = req.session.userid;
	sql = `INSERT INTO surveys (heading, description, creator_id, public) VALUES (${heading}, ${description}, ${creatorid}, ${public})`;
	ex_query(res, sql, undefined, (_) => {
		getLastId(res, (surveyid) => {
			position = 0;
			for (let question of questions) {
				let failed = createQuestion(
					res,
					surveyid,
					question,
					objectHash(question),
					position
				);
				if (failed) return;
				position += 1;
			}
			res.status(200).end('Survey created');
		})
	});
});

const createQuestion = (res, surveyid, question, hash, position) => {
	const {heading, description, field_data = '', question_type} = question;
	if (!questionTypes.includes(question_type)) {
		res.status(422).end('Invalid question type, use the survey creation page!'); // Shouldn't be possible if request is sent from the frontend
		return true;
	}
	if (!heading) {
		res.status(422).end('A heading is mandatory to create a question');
		return true;
	}
	if (!description) {
		res.status(422).end('A description is mandatory to create a question');
		return true;
	}
	if (!checkFieldData(question_type, field_data)) {
		res.status(422).end(`Invalid format for the input field data of question number ${position+1}`)
		return true
	}
	ex_query(res, `INSERT INTO questions (heading, description, field_data, question_type, hash) VALUES (${mysql.escape(heading)}, ${mysql.escape(description)}, ${mysql.escape(JSON.stringify(field_data))}, '${question_type}', ${mysql.escape(hash)})`, undefined, (result) => {
		ex_query(res, `SELECT id FROM questions WHERE hash = ${mysql.escape(hash)}`, undefined, (result) => {
			const questionid = result[0].id;
			ex_query(res, `INSERT INTO survey_questions (survey_id, question_id, position) VALUES (${surveyid}, ${questionid}, ${position})`);
		})
	});
	return false;
}

const checkFieldData = (question_type, field_data) => {
	switch (question_type) {
		case 'short_question':
			return field_data === '';
		case 'paragraph':
			return field_data === '';
		case 'linear_scale':
			// If there are labels on the scale there should be two as the rightmost option on the scale relates more to the label to the right of the scale, and likewise for the leftmost option
			// Alternatively there would be no labels, and the scale is taken as the degree to which the respondent agrees with the question's description
			if (typeof field_data.scale !== "number") return false;
			if (field_data.labels) {
				if (Object.keys(field_data.labels).length !== 2) return false;
				if (!field_data.labels.left || !field_data.labels.right || typeof field_data.labels.left !== "string" ||  typeof field_data.labels.right !== "string") return false;
			}
			return true;
		case 'date':
			return field_data === '';
			// // Thinking of requirement 7, Guarantee we have a field_data like "2023-06-05"
			// return field_data === (new Date(field_data)).toISOString().slice(0,10)
		case 'time':
			return field_data === '';
			// // Thinking of requirement 7, Guarantee we have a field_data like "12:46"
			// if (typeof field_data !== "string" || field_data.length !== 5 || field_data[2] !== ":") return false;
			// let hours = Number(field_data.slice(0,2));
			// let minutes = Number(field_data.slice(3,5));
			// if (isNaN(hours) || isNaN(minutes) || !Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
			// if (hours < 0 || hours > 24 || minutes < 0 || minutes > 60) return false;
			// break;
		case 'email':
			return field_data === '';
		case 'numeric values':
			return field_data === '';
		default: break;
	}
	for (let li of field_data.options) if (typeof li !== "string") return false
	switch (question_type) {
		case 'dropdown':
			break;
		case 'multiple_choice':
			break;
		case 'checkboxes':
			break;
		case 'single_correct':
			if (typeof field_data.correct !== "number" || field_data.correct < 0 || field_data.correct > field_data.options.length-1 ) return false
			break;
		case 'multiple_correct':
			for (let correct of field_data.correct) if (typeof correct !== "number" || field_data.correct < 0 || field_data.correct > field_data.options.length-1 ) return false
			break;
		case 'multiple_choice_grid':
			// On the frontend ptions will be each row, and choices will be in each column
			for (let li of field_data.choices) if (typeof li !== "string") return false
			break;
		default:
		return false;
	}
	return true
}

const getLastId = (res, callback) => {
	ex_query(res, 'SELECT LAST_INSERT_ID()', undefined, (result) => {
		const lastid = result[0]['LAST_INSERT_ID()'];
		callback(lastid);
	});
}

app.get('/survey-:id', function (req, res) {
	const id = req.params.id;
	getSurveyAccess(res, id, (public, creatorid) => {
		if (!public) {
			if (!isLoggedIn(req, res, 'This survey has restricted access, login is required')) return;
			const userid = req.session.userid;
			if (userid === creatorid) {
				fetchSurvey(id, res);
				return;
			}
			ex_query(res, `SELECT * FROM survey_access WHERE user_id = ${userid} AND survey_id = ${id}`, undefined, succCallback = (result) => {
				if (result.length === 0) {
					res.status(401).end('Your account doesn\'t have access to this survey');
					return;
				}
				fetchSurvey(id, res);
			});
			return;
		}
		fetchSurvey(id, res);
	});
})

app.post('/share-survey/:id/:userid', function (req, res) {
	if (!isLoggedIn(req, res, 'This action can only be performed from authenticated accounts')) return;
	const id = req.params.id;
	getSurveyAccess(res, id, (public, creatorid) => {
		if (public) {
			res.status(409).end('This survey is public and can already be accessed by everyone');
			return;
		}
		const sharerid = req.session.userid;
		const receiverid = req.params.userid;
		if (sharerid !== creatorid) {
			res.status(401).end('Only the creator of a survey has permission to share it with others');
			return;
		}
		if (sharerid === receiverid) {
			res.status(409).end('The creator of a survey already has access to it');
			return;
		}
		ex_query(res, `SELECT * FROM survey_access WHERE user_id = ${receiverid} AND survey_id = ${id}`, undefined, succCallback = (result) => {
			if (result.length > 0) {
				res.status(409).end('This account already has access to the survey');
				return;
			}
			ex_query(res, `INSERT INTO survey_access (user_id, survey_id) VALUES (${receiverid}, ${id})`)
		});
	});
})

const getSurveyAccess = (res, id, callback) => {
	ex_query(res, `SELECT public, creator_id FROM surveys WHERE id = ${id}`, undefined, (result) => {
		if (result.length === 0) {
			res.status(404).end('Survey not found')
			return;
		}
		callback(result[0].public, result[0].creator_id);
	})
}

const fetchSurvey = (id, res) => {
	ex_query(res, `SELECT * FROM surveys WHERE id = ${id}`, undefined, (result) => {
		const survey = {
			heading: result[0].heading,
			description: result[0].description
			// TODO: process questions
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

updateUserAccess (remove)
*/

var server = app.listen(8081, function () {
	var port = server.address().port
	console.log("REST API listening at http://localhost:%s", port)
})
