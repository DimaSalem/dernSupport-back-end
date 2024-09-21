import { client } from "../server.js";
import bcrypt from "bcrypt";
import { io } from "../server.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import sgMail from "@sendgrid/mail";
import { verifyTokenEmail } from "../middlewares/authMiddleware.js";
import {
  assignTechnician,
  generateEstimates,
} from "../helper/helperMethods.js";

export const testIo = async (req, res) => {
  console.log("Request received");

  const body = req.body;
  console.log(body);

  // create an idintity id  for each notification
  const notificationId = uuidv4();

  io.emit("newRequest", {
    id: notificationId,
    message:
      "Your order has been successfully scheduled. Go to the information page to see the status of your order",
  });

  res.status(200).json("done");
};

//Not route
// generate a token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
};
//Not route
// Sending email to customer account to verify his email
const sendEmail = async (Email, token) => {
  const verificationLink = `https://back-end-st2z.onrender.com/customers/verify-email?token=${token}`;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const msg = {
    to: Email,
    from: {
      name: "Dern Support",
      email: "hasankarraz7@gmail.com",
    },
    subject: "Verify your email",
    html: `
    <b><p style="font-size: 14px;">Thank you for signing up. Please verify your email by clicking the link below:</p></b>
<center>
  <b>
    <a href="${verificationLink}" style="font-size: 18px; text-decoration: none; display: inline-block; margin: 0 auto;">
      Verify Email
    </a>
  </b>
</center>
    `,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error("Error sending email", error);
    return { success: false, error: error.message };
  }
};

//This routes called automatically when the customer click on the link inside his email
//=============================/customers//verify-email========================================
// /customers//verify-email
// Tested
export const customerVerifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const decoded = verifyTokenEmail(token);
    const userId = decoded.id;
    await client.query('UPDATE "User" SET isVerified = true WHERE ID = $1', [
      userId,
    ]);

    res.redirect(302, "https://dern-support-three.vercel.app/verify-email");
    // res.status(200).json({
    //   success: true,
    //   message: "Email verified successfully.",
    // });
  } catch (error) {
    console.error("Error verifying email", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

//=============================/customers/signup========================================
// /customers/signup
// Tested
export const customerSignup = async (req, res) => {
  const { Name, Email, Password, PhoneNumber, AccountType } = req.body;
  if (!Name || !Email || !Password || !PhoneNumber || !AccountType) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existingUser = await client.query(
      `SELECT * FROM "User" WHERE Email = $1`,
      [Email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);
    const result = await client.query(
      `
      INSERT INTO "User" (Name, Email, Password, PhoneNumber)
      VALUES ($1, $2, $3, $4) RETURNING ID;
    `,
      [Name, Email, hashedPassword, PhoneNumber]
    );

    const userId = result.rows[0].id;
    const token = generateToken(userId);

    await client.query(
      `
      INSERT INTO Customer (UserID, AccountType)
      VALUES ($1, $2);
    `,
      [userId, AccountType]
    );

    const emailResult = await sendEmail(Email, token);
    if (!emailResult.success) {
      return res
        .status(500)
        .json({ error: "Failed to send verification email" });
    }

    return res.status(200).json({
      success: true,
      token,
      message:
        "Signup successful. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Error executing query", error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};

//End TEST

//=============================/customers/login=========================================
// /customers/login
// Tested
export const customerLogin = async (req, res) => {
  const { Email, Password } = req.body;

  //all field required
  if (!Email || !Password) {
    return res.status(400).json({ error: "Email and Password are required" });
  }

  try {
    //check if the user exists in the database (using email as the unique identifier)
    const sql = `SELECT Customer.id, "User".email, "User".password, "User".isVerified 
    FROM "User"
    JOIN Customer ON "User".id = Customer.userid
    WHERE "User".email = $1;`;

    const result = await client.query(sql, [Email]);

    // check if the user is exist or not
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found :(" });
    }

    // check if the user is verified or not
    if (!result.rows[0].isverified) {
      return res
        .status(401)
        .json({ error: "User is not verified. Please verify your email" });
    }

    // compare the password with the password stored in the database (using bcrypt)
    // bcrypt.compare(plainTextPassword, hashedPassword)
    // plainTextPassword is the password provided by the user in the login request
    // hashedPassword is the password stored in the database in hashed format
    const { password } = result.rows[0];
    const isMatch = await bcrypt.compare(Password, password);

    //Check if the password matches the password stored in the database
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid Email Or Password" });
    }

    const customerId = result.rows[0].id;
    //Token
    const token = generateToken(customerId);
    res.status(200).json({
      message: "Login successfully",
      success: true,
      token,
    });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

//=============================/customers/logout========================================

// /customers/logout
export const customerLogout = (req, res) => {
  //TODO: based on the middleware authentication
  // JWT token invalidation would be handled here
  res.status(200).json({ message: "Logged out successfully" });
};

//=============================/customers/get-estimated-time-cost========================================
// /customers/get-estimated-time-cost TODO: GET
//Tested
export const customerGetEstimatedTimeAndCost = async (req, res) => {
  console.log(req.body);
  const { Category } = req.body;
  try {
    const { estimatedCost, estimatedCompletionTime } = await generateEstimates(
      Category
    );
    res.status(201).json({
      EstimatedTime: estimatedCompletionTime,
      EstimatedCost: estimatedCost,
    });
  

    
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

//=============================/customers/send-service-request========================================
// /customers/send-service-request
//Tested
export const customerSendServiceRequest = async (req, res) => {
  const CustomerID = req.userId; //form authMiddleware

  //console.log(CustomerID);
  const { ServiceID, Method } = req.body;

  //all field required
  if (!CustomerID || !ServiceID || !Method) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    await client.query("BEGIN"); //FROM Tabnine Ai I will test it later

    const sqlQuery = `SELECT Category FROM Service WHERE ID = $1`;

    // get the category from the Service table
    const categoryResult = await client.query(sqlQuery, [ServiceID]);
    const category = categoryResult.rows[0].category;

    const technicianId = await assignTechnician(category);

    const { estimatedCost, estimatedCompletionTime } = await generateEstimates(
      category
    );

    //insert the new request into the database
    //and set the status to "Pending" (or we can discuss other statuses)//(TODO)
    //and discuss Urgency Values(TODO)
    const requestResult = await client.query(
      `
      INSERT INTO Request (CustomerID, TechnicianID, Status, DeviceDeliveryMethod, CreatedDate, EstimatedTime,
      RequestType)
      VALUES ($1, $2,'Pending', $3, CURRENT_TIMESTAMP, $4, 'ServiceRequest')
      RETURNING id;
    `,
      [CustomerID, technicianId, Method, estimatedCompletionTime]
    );
    //TODO: Hassan--> check if customer id exists or not (CustomerID or ID)

    const requestID = requestResult.rows[0].id;
    await client.query(
      `
      INSERT INTO ServiceRequest (ServiceID, RequestID)
      VALUES ($1, $2);
    `,
      [ServiceID, requestID]
    );

    //USAGE TIME
    await client.query(
      `
      UPDATE Service
      SET UsageTime = UsageTime + 1
      WHERE id = $1;
      WHERE id = $1;
    `,
      [ServiceID]
    );
    await client.query("COMMIT"); //FROM Tabnine Ai

    res.status(201).json({ message: "Service requested" });
    io.emit("newRequest", {
      role: "customers",  
      id: uuidv4(),
      message: "Your order has been successfully scheduled. Go to the AllRequests page  to see the status of your order",
    });
  } catch (error) {
    await client.query("ROLLBACK"); //FROM Tabnine Ai
    console.error("Error executing query", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

//=============================/customers/send-feedback========================================
// /customers/send-feedback
//Tested
export const customerSendFeedback = async (req, res) => {
  const CustomerID = req.userId; //form authMiddleware

  const { ServiceID, Rating, Comment } = req.body;

  //all field required
  if (!CustomerID || !ServiceID || !Rating) {
    return res
      .status(400)
      .json({ error: "CustomerID, ServiceID, and Rating are required" });
  }

  try {
    //insert the new feedback into the database
    await client.query(
      `
      INSERT INTO Feedback (CustomerID, ServiceID, Rating, Comment)
      VALUES ($1, $2, $3, $4);
    `,
      [CustomerID, ServiceID, Rating, Comment]
    );

    res.status(201).json({ message: "Feedback submitted" });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

//=============================/customers/my-requests========================================
// /customers/my-requests
// Tested
export const customerGetAllRequests = async (req, res) => {
  const customerId = req.userId; // from middleware
  try {
    // select the Status, EstimatedTime, and RequestType from the Request table
    const requestResult = await client.query(
      `
      SELECT ID, Status, EstimatedTime, RequestType 
      FROM Request 
      WHERE CustomerID = $1;
    `,
      [customerId]
    );

    //Store the response object
    const requests = requestResult.rows;

    // THis array to store the final results and send it to frontend based on RequestType
    const results = [];

    // Loop on each request to get more info(Title & ActualCost ) based on RequestType
    for (const request of requests) {


      let detailResult; //to store more info
      let feedbackId = null;
      let serviceId;
      //Case 1:
      if (request.requesttype == "NewRequest") {
        console.log("from new request");

        // Fetch Title and ActualCost from NewRequest table
        detailResult = await client.query(
          `
          SELECT Title, ActualCost 
          FROM NewRequest 
          WHERE RequestID = $1;
        `,
          [request.id]
        );
      }
      //Case 2:
      
      else if (request.requesttype == "ServiceRequest") {
        // Fetch Title and ActualCost from Service table

        
        detailResult = await client.query(
          `
          SELECT  id, Title, ActualCost
          FROM Service 
          WHERE ID = (
            SELECT ServiceID 
            FROM ServiceRequest 
            WHERE RequestID = $1
          );
        `,
          [request.id]
        );

        serviceId = detailResult.rows[0].id;

        feedbackId = (
          await client.query(
            `
          SELECT ID 
          FROM Feedback
          WHERE ServiceID = $1;
          `,
            [serviceId]
          )
        )?.rows[0]?.id;
      }

     // console.log(detailResult);
      const hasData = detailResult && detailResult.rows.length > 0;
      // Push the title and actual cost to the results array

      results.push({
        id: request.id,
        feedbackId: feedbackId,
        serviceId: serviceId,
        status: request.status,
        estimatedTime: request.estimatedtime,
        requestType: request.requesttype,
        title: hasData ? detailResult.rows[0].title : null,
        actualCost: hasData ? detailResult.rows[0].actualcost : null,
      });
    }

    // Send the final results to the client
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

//=============================/customers/final-approval-support-request========================================
// /customers/final-approval-support-request
//Tested
export const customerSenApprovedSupportRequest = async (req, res) => {
  console.log(req.body);
  const CustomerID = req.userId;

  console.log(CustomerID);
  const { Description, DeviceDeliveryMethod, Title, Category } = req.body;
  // TODO: CALL assign function From L

  const technicianId = await assignTechnician(Category);

  const { estimatedCost, estimatedCompletionTime } = await generateEstimates(
    Category
  );

  // All fields required
  if (
    !CustomerID ||
    !Description ||
    !DeviceDeliveryMethod ||
    !Title ||
    !Category
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Insert the new request into the database
    const requestResult = await client.query(
      `
      INSERT INTO Request (CustomerID, TechnicianID, Status, DeviceDeliveryMethod, CreatedDate, EstimatedTime,
      RequestType)
      VALUES ($1, $2,'Pending', $3, CURRENT_TIMESTAMP, $4,  'NewRequest')
      RETURNING id;
    `,
      [CustomerID, technicianId, DeviceDeliveryMethod, estimatedCompletionTime]
      // [CustomerID, technicianId, DeviceDeliveryMethod, 2]
    );

    const requestID = requestResult.rows[0].id;

    // Insert into NewRequest table
    // Get image link here if necessary
    // TEST =================TODO========================
    // Check nullable
    let imgUrl;
    if (req.file !== undefined) {
      // Variable is undefined
      const filename = req.file.filename;
      console.log(filename);
      imgUrl = `${filename}`;
    }

    console.log(imgUrl);
    // TEST =================TODO========================
    await client.query(
      `
      INSERT INTO NewRequest (IssueDescription, Title, Category,  EstimatedCost, Image, RequestID)
      VALUES ($1, $2, $3, $4, $5, $6);
    `,
      [Description, Title, Category, estimatedCost, imgUrl, requestID]
    );

    io.emit("newRequest", {
      role: "customers",  
      role: "customer",
      id: uuidv4(),
      message:
        "Your order has been successfully scheduled. Go to the information page to see the status of your order",
    });
    
    io.emit("newRequest", {
      role: "admin",  
      id: uuidv4(),
      message: "A new request has been submitted by the customer. Please review the order log."
    });
      

    res.status(201).json({ message: "Request submitted" });

    //res.status(201).json({ message: "Request submitted" });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

//=============================/customers/getFeedback========================================
// /customers/getFeedback
//Tested
export const customerGetFeedback = async (req, res) => {
  //// Get one feedback based on the service ID and customer ID
  const { serviceId } = req.params;
  const customerId = req.userId;

  //
  if (!serviceId) {
    return res.status(400).json({ error: "ServiceID is required" });
  }

  try {
    const result = await client.query(
      `
      SELECT * FROM Feedback WHERE ServiceID = $1 AND CustomerID = $2;
    `,
      [serviceId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No feedback found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};
