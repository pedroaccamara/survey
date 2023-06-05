# Run this project locally with
$ `sudo service mysql start`  
$ `npm install`  
$ `node server.js`  


# A few example requests that could prove useful to test  
## Register  
$ `curl -X POST -H "Content-Type: application/json" -d '{"email":"firstuser", "password": "12345"}' localhost:8081/register`  

## Login  
$ `curl -X POST -H "Content-Type: application/json" -d '{"email":"firstuser", "password": "12345"}' localhost:8081/login`  

## Create Survey  
Posting to /new-survey, and already logged in  
```json
{
    "heading": "Multiple Questions Survey",
    "description": "This is a survey with multiple questions",
    "public": false,
    "questions": [
        {
            "heading": "Flat earth",
            "description": "How much do you consider the earth to be flat",
            "question_type": "linear_scale",
            "field_data": {
                "scale": 5,
                "labels": {
                    "left": "Extremely Flat",
                    "right": "Super non-flat"
                }
            }
        },
        {
            "heading": "Favourite animal",
            "description": "Choose your favourite animal type",
            "question_type": "checkboxes",
            "field_data": {
                "options": ["Cat", "Dog"]
            }
        },
        {
            "heading": "Lazier colour",
            "description": "Which colour emits less energy",
            "question_type": "single_correct",
            "field_data": {
                "correct": 1,
                "options": ["violet", "orange", "blue", "indigo", "green"]
            }
        },
        {
            "heading": "Filosofy prize for the taking",
            "description": "What came first, the chicken or the egg, and why?",
            "question_type": "short_question"
        }
    ]
}
```

## Database
$ `CREATE TABLE users (id INT(11) AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255), password VARCHAR(255));`  

$ `CREATE TABLE surveys (id INT(11) AUTO_INCREMENT PRIMARY KEY, heading VARCHAR(255) NOT NULL, description VARCHAR(255),  creator_id INT(11), public TINYINT(1) DEFAULT 1, FOREIGN KEY (creator_id) REFERENCES users(id));`  

$ `CREATE TABLE survey_access (id INT(11) AUTO_INCREMENT PRIMARY KEY, user_id INT(11), survey_id INT(11), FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (survey_id) REFERENCES surveys(id));`  

$ `CREATE TABLE questions (id INT PRIMARY KEY AUTO_INCREMENT, heading VARCHAR(255) NOT NULL, description VARCHAR(255) NOT NULL, field_data VARCHAR(255) NOT NULL, question_type ENUM('short_question', 'paragraph', 'dropdown', 'multiple_choice', 'single_correct', 'multiple_correct', 'checkboxes', 'linear_scale', 'date', 'time', 'multiple_choice_grid', 'email', 'numeric values') NOT NULL, hash VARCHAR(255));`  

$ `CREATE TABLE survey_questions (survey_id INT NOT NULL, question_id INT NOT NULL, position INT NOT NULL, PRIMARY KEY (survey_id, question_id), FOREIGN KEY (survey_id) REFERENCES surveys(id), FOREIGN KEY (question_id) REFERENCES questions(id));`  