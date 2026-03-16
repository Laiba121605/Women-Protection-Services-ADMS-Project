**SET UP AND INSTRUCTIONS**  
**Roll number**  
BSCS24124  
BSCS24128

 **Prerequisites**  
 Node.js v18+  
 MySQL

**Key packages used**

* express   
* mysql2   
* bcrypt   
* Jsonwebtoken  
*  Dotenv  
*  Body-parser  
*  crypto


**Setup Instructions**

* Clone the Repository  
* Download or clone the project files.

 **Install Dependencies**  
 Open terminal in the project folder and run:  
 npm install   
   
**Configure Environment Variables**  
Create a .env file in the project root based on .env.example and fill in your database credentials:  
DB\_HOST=localhost  
DB\_USER=your\_mysql\_username  
DB\_PASSWORD=your\_mysql\_password  
DB\_NAME=womenprotectionservicesdb  
DB\_CONNECTION\_LIMIT=10

**Set Up the Database**  
Open MySQL and run the following files in order:

1. schema.sql creates all tables, triggers and views  
2. seed.sql inserts sample data

**Start the Server**  
node server.js  
The server will run on http://localhost:5000

**Running Tests**  
Make sure the server is running, then run tests

**API Base URL**  
http://localhost:5000/api

**Default Test Credentials**  
All seed users have the password: Test@1234  
