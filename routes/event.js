const router = require("express").Router();
var authUser = require("../middleware/authUser");
const { body, validationResult } = require("express-validator");
//import task model
const EventSchema = require("../models/eventSchema");
const UserSchema = require("../models/userSchema");
const ClubSchema = require("../models/clubSchema");

// routes
//get all events
router.get("/allEvents", async (req, res) => {
  try {
    const allEvents = await EventSchema.find();
    allEvents.sort((a, b) => {
      a.startTime - b.startTime;
    });

    // console.log("error",allTasks);
    res.status(200).json(allEvents);
  } catch (error) {
    res.json(error);
  }
});

//add an event
router.put(
  "/addEvent/:clubId",
  authUser,
  [
    body("title", "min length is 2").isLength({ min: 2 }).escape(),
    body("description", "at least 5 characters").isLength({ min: 5 }).escape(),
    body("startTime", "must be in format: YYYY-MM-DDTHH:mm:ss.000+05:00")
      .isISO8601()
      .toDate()
      .escape(),
    body("endTime", "must be in format: YYYY-MM-DDTHH:mm:ss.000+05:00")
      .isISO8601()
      .toDate()
      .escape(),
    body("venue", "at least 5 characters").isLength({ min: 5 }).escape(),
  ],
  async (req, res) => {
    try {
      const { title, description, venue, startTime, endTime } = req.body;

      // If validation fails
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
        });
      }

      // If validation success - create new event
      const newEvent = new EventSchema({
        title,
        description,
        startTime,
        endTime,
        venue,
        creator: req.existUser.id,
        ofClub: req.params.clubId,
      });
      const clubExist = await ClubSchema.findById(req.params.clubId);
      if (!clubExist) return res.status(404).json("Club not found.");
      await newEvent.save();
      await EventSchema.findByIdAndUpdate(
        req.existUser.id,
        {
          $addToSet: {
            ofClub: req.params.clubId,
          },
        },
        { new: true }
      );

      await UserSchema.findByIdAndUpdate(
        req.existUser.id,
        {
          $addToSet: {
            eventsCreated: newEvent.id,
          },
        },
        { new: true }
      );

      res.status(200).json(newEvent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

//delete an event
router.delete("/deleteEvent/:id", authUser, async (req, res) => {
  try {
    // If validation fails
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array(),
      });
    }
    let existEvent = await EventSchema.findById(req.params.id);
    //if no task exists at given id
    if (!existEvent) {
      return res.status(404).json("No task found");
    }
    //if user is unauthorized
    if (existEvent.creator.toString() !== req.existUser.id) {
      return res.status(401).json("Unauthorized");
    }

    await EventSchema.findByIdAndDelete(req.params.id);
    await UserSchema.findByIdAndUpdate(
      req.existUser.id,
      {
        $pull: {
          eventsCreated: req.params.id,
        },
      },
      { new: true }
    );
    res.status(200).json(`removed event ${req.params.id}`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
