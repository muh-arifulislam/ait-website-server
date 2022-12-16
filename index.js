const express = require("express");
const fs = require("fs");
const app = express();
require("dotenv").config();
const cors = require("cors");
const path = require("path");
const sharp = require("sharp");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { query } = require("express");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
app.use(express.json());
const UPLOADS_FOLDER = "./public/images";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_FOLDER);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const fileName =
      file.originalname
        .replace(fileExt, "")
        .toLowerCase()
        .split(" ")
        .join("-") +
      "-" +
      Date.now();
    cb(null, fileName + fileExt);
  },
});
let upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/jpeg"
    ) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});
const deleteImage = (fileName) => {
  fs.unlinkSync(`./public/images/${fileName}`);
};
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tu097d5.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
app.get("/", (req, res) => {
  res.send("Hello I am from the ");
});

async function run() {
  try {
    await client.connect();
    const eventCollection = client.db("ait-website").collection("events");
    const instructorCollection = client
      .db("ait-website")
      .collection("instructors");
    const sliderCollection = client.db("ait-website").collection("sliders");
    const postCollection = client.db("ait-website").collection("posts");
    const courseCollection = client.db("ait-website").collection("courses");
    const userCollection = client.db("ait-website").collection("users");
    const serviceCollection = client.db("ait-website").collection("services");
    const messageCollection = client.db("ait-website").collection("messages");

    // app.use(express.static("public"));
    app.use("/public/images", express.static("public/images"));

    // verify user
    app.get("/verify-jwt/:accessToken", async (req, res) => {
      const token = req.params.accessToken;
      jwt.verify(
        token,
        process.env.ACCESS_SECRET,
        async function (err, decoded) {
          if (err) {
            res.status(403).send({ message: "forbidden access", status: true });
          } else {
            const query = { email: decoded?.email };
            const result = await userCollection.findOne(query);
            if (result?.email && !result?.disabled) {
              res.status(200).send({ message: "success", status: false });
            } else {
              res
                .status(403)
                .send({ message: "forbidden access", status: true });
            }
          }
        }
      );
    });

    // provide jwttoken
    app.get("/login/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      token = jwt.sign({ email: email }, process.env.ACCESS_SECRET, {
        expiresIn: "2d",
      });
      res.send({ accessToken: token });
    });

    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const users = await cursor.toArray();
      res.send(users);
    });

    // get single user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // insert single user
    app.post("/user", async (req, res) => {
      const doc = req.body;
      doc.disabled = false;
      const result = await userCollection.insertOne(doc);
      res.send(result);
    });

    // delete single user
    app.delete("/user/:id", async (req, res) => {
      const userId = req.params.id;
      const query = { _id: ObjectId(userId) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    // update user status
    app.put("/user/:id", async (req, res) => {
      const userId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(userId) };
      const update = { $set: { disabled: doc.status } };
      const result = await userCollection.updateOne(filter, update);
      res.send(result);
    });

    // get all events
    app.get("/events", async (req, res) => {
      const cursor = eventCollection.find();
      const events = await cursor.toArray();
      res.send(events);
    });

    // get 3 latest event
    app.get("/latest-events", async (req, res) => {
      const cursor = eventCollection.find().sort({ date: -1 }).limit(3);
      const events = await cursor.toArray();
      res.send(events);
    });

    // get single event
    app.get("/event/:eventId", async (req, res) => {
      const eventId = req.params.eventId;
      const query = { eventId };
      const result = await eventCollection.findOne(query);
      res.send(result);
    });

    // insert a single event
    app.post("/event", async (req, res) => {
      const doc = req.body;
      const estimate = await eventCollection.estimatedDocumentCount();
      doc.eventId = "event-" + "10" + (estimate + 1);
      const result = await eventCollection.insertOne(doc);
      res.send(result);
    });

    // insert a single instructor
    app.post("/instructor", async (req, res) => {
      const doc = req.body;
      const estimate = await instructorCollection.estimatedDocumentCount();
      doc.instructorId = "instructor-" + "100" + (estimate + 1);
      const result = await instructorCollection.insertOne(doc);
      res.send(result);
    });

    // get all instructors
    app.get("/instructors", async (req, res) => {
      const cursor = instructorCollection.find();
      const instructors = await cursor.toArray();
      res.send(instructors);
    });

    app.delete("/instructor/:id", async (req, res) => {
      const instructorId = req.params.id;
      const query = { _id: ObjectId(instructorId) };
      const result = await instructorCollection.deleteOne(query);
      res.send(result);
    });

    // delete single event
    app.delete("/event/:id", async (req, res) => {
      const eventId = req.params.id;
      const query = { _id: ObjectId(eventId) };
      const event = await eventCollection.findOne(query);
      const imgList = event.img.split("/");
      const imgName = imgList[imgList.length - 1];
      deleteImage(imgName);
      const result = await eventCollection.deleteOne(query);
      res.send(result);
    });

    // insert single slider
    app.post("/slider", async (req, res) => {
      const doc = req.body;
      const estimate = await sliderCollection.estimatedDocumentCount();
      doc.sliderId = "slider-" + "10" + (estimate + 1);
      const result = await sliderCollection.insertOne(doc);
      res.send(result);
    });

    // delete single slider
    app.delete("/slider/:id", async (req, res) => {
      const sliderId = req.params.id;
      const query = { _id: ObjectId(sliderId) };
      const result = await sliderCollection.deleteOne(query);
      res.send(result);
    });

    // get all slider
    app.get("/sliders", async (req, res) => {
      const cursor = sliderCollection.find();
      const sliders = await cursor.toArray();
      res.send(sliders);
    });

    // get all service
    app.get("/services", async (req, res) => {
      const cursor = serviceCollection.find();
      const services = await cursor.toArray();
      res.send(services);
    });

    // insert single service
    app.post("/service", async (req, res) => {
      const doc = req.body;
      const result = await serviceCollection.insertOne(doc);
      res.send(result);
    });

    // delete single slider
    app.delete("/service/:id", async (req, res) => {
      const serviceId = req.params.id;
      const query = { _id: ObjectId(serviceId) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    // update service status
    app.put("/service/:id", async (req, res) => {
      const serviceId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(serviceId) };
      const update = { $set: { disabled: doc.status } };
      const result = await serviceCollection.updateOne(filter, update);
      res.send(result);
    });

    // get all post
    app.get("/posts", async (req, res) => {
      const cursor = postCollection.find();
      const posts = await cursor.toArray();
      res.send(posts);
    });

    // get 3 latest post
    app.get("/latest-posts", async (req, res) => {
      const cursor = postCollection.find().sort({ date: -1 }).limit(3);
      const posts = await cursor.toArray();
      res.send(posts);
    });

    // get single post
    app.get("/post/:postId", async (req, res) => {
      const postId = req.params.postId;
      const query = { postId };
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    // insert single post
    app.post("/post", async (req, res) => {
      const doc = req.body;
      const estimate = await postCollection.estimatedDocumentCount();
      doc.postId = "post-" + "10" + (estimate + 1);
      const result = await postCollection.insertOne(doc);
      res.send(result);
    });

    // delete single post
    app.delete("/post/:id", async (req, res) => {
      const postId = req.params.id;
      const query = { _id: ObjectId(postId) };
      const result = await postCollection.deleteOne(query);
      res.send(result);
    });

    // get all courses
    app.get("/courses", async (req, res) => {
      const cursor = courseCollection.find();
      const courses = await cursor.toArray();
      res.send(courses);
    });

    // insert single course
    app.post("/course", async (req, res) => {
      const doc = req.body;
      const imageName = doc.img.split("/images/")[1];
      const thumbName = doc.thumb.split("/images/")[1];
      const resizedImageName = imageName.replace("-", "-res-");
      const resizedThumbName = thumbName.replace("-", "-res-");
      await sharp(`./public/images/${imageName}`)
        .resize({
          fit: "fill",
          width: 1940,
          height: 946,
        })
        .toFile(`./public/images/${resizedImageName}`);
      await sharp(`./public/images/${thumbName}`)
        .resize({
          fit: "fill",
          width: 420,
          height: 230,
        })
        .toFile(`./public/images/${resizedThumbName}`);
      // delete main image
      deleteImage(imageName);
      deleteImage(thumbName);
      // replace image name in database
      doc.img = `http://localhost:5000/public/images/${resizedImageName}`;
      doc.thumb = `http://localhost:5000/public/images/${resizedThumbName}`;
      const estimate = await courseCollection.estimatedDocumentCount();
      doc.courseId = "course-" + "10" + (estimate + 1);
      const query = { _id: ObjectId(doc.instructor) };
      const instructor = await instructorCollection.findOne(query);
      doc.instructorImg = instructor.img;
      const result = await courseCollection.insertOne(doc);
      res.send(result);
    });

    // update course status
    app.put("/course/:id", async (req, res) => {
      const courseId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(courseId) };
      const update = { $set: { disabled: doc.status } };
      const result = await courseCollection.updateOne(filter, update);
      res.send(result);
    });

    // delete single course
    app.delete("/course/:id", async (req, res) => {
      const courseId = req.params.id;
      const query = { _id: ObjectId(courseId) };
      const course = await courseCollection.findOne(query);
      const imgList = course.img.split("/");
      const imgName = imgList[imgList.length - 1];
      const thumbList = course.thumb.split("/");
      const thumbName = thumbList[thumbList.length - 1];
      deleteImage(imgName);
      deleteImage(thumbName);
      const result = await courseCollection.deleteOne(query);
      res.send(result);
    });

    // upload image
    app.post(
      "/upload/images",
      upload.fields([
        { name: "image", maxCount: 1 },
        { name: "thumnail", maxCount: 1 },
      ]),
      (req, res) => {
        res.send(req.files);
      }
    );

    // upload single image
    app.post("/upload/image", upload.single("image"), (req, res) => {
      res.send(req.file);
    });

    // delete an image
  } finally {
    // await client.connect();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log("Server is running on port", port);
});
