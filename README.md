# Run this project locally with
$ `sudo service mysql start`  
$ `node server.js`  


# A few example requests that could prove useful to test  
## Register  
$ `curl -X POST -H "Content-Type: application/json" -d '{"email":"value1", "password": "value2"}' localhost:8081/register`  

## Create Survey  
Posting to /new-survey, and already logged in  
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
