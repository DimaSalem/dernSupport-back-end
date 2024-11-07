import { client } from "../server.js";
import { io } from "../server.js";
import { v4 as uuidv4 } from "uuid";
// io.emit("newRequest", {
//   userType:"customers",
//   id: uuidv4(),
//   message: "Your order has been successfully scheduled. Go to the information page to see the status of your order",
// });
export const assignTechnician = async (requestCategory) => {
  try {
    // Step 1: Find the most available technician with the required category
    const technicianResult = await client.query(
      `
        SELECT ID 
        FROM Technician 
        WHERE Specialization = $1
        ORDER BY Availability ASC 
        LIMIT 1;
        `,
      [requestCategory]
    );

    // Check if a technician was found
    if (technicianResult.rows.length === 0) {
      throw new Error("No available technician found");
    }

    const technicianId = technicianResult.rows[0].id;

    // // Step 2: Assign the most available technician to the request
    // await client.query(
    //   `
    //     UPDATE Request
    //     SET TechnicianId = $1
    //     WHERE Id = $2;
    //     `,
    //   [technicianId, requestId]
    // );
    io.emit("newRequest", {
      role: "technician",
      id: uuidv4(),
      message:
        "A new request has been submitted by the customer. Please review the order log.",
    });

    return technicianId;
  } catch (error) {
    console.error("Error assigning technician", error.stack);
    throw new Error("Technician assignment failed");
  }
};

// Call the assignTechnician function to automatically assign a technician to this request
// const technicianId = await assignTechnician(SpecializationRequired, requestId);

export const generateEstimates = async (category) => {
  let estimatedCost;

  // Calculate the estimated cost based on category
  switch (category.toLowerCase()) {
    case "hardware":
      estimatedCost = 50;
      break;

    case "software":
      estimatedCost = 25;
      break;
  }

  // Find the earliest available technician for the given specialization
  const result = await client.query(
    `
      SELECT availability
      FROM Technician
      WHERE specialization = $1
      ORDER BY availability ASC
      LIMIT 1;
      `,
    [category]
  );

  if (result.rows.length === 0) {
    throw new Error("No available technician");
  }

  const technician = result.rows[0];
  const estimatedCompletionTime = technician.availability; //""

  console.log(estimatedCompletionTime);
  return { estimatedCost, estimatedCompletionTime };
};

// Generate the estimated cost and completion time
// const { estimatedCost, estimatedCompletionTime } = await generateEstimates(
//   Specialization
// );
