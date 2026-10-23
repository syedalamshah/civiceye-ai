# RoadLens AI: judge presentation

Use this as a speaking guide. Keep the browser visible during the demonstration. The spoken sections take about four minutes with the live demo; questions are separate. This fits the team's confirmed 3–5-minute demonstration-video requirement. The official DITE Hackathon 2026–27 guidelines are supplied outside this repository; no absent guidelines file has been reviewed here.

## Confirmed team

- **Masab, Team Lead and Frontend Engineer:** React frontend and user interface.
- **Syed Alam Shah Bukhari, Backend and AI Engineer:** FastAPI, ONNX inference, and pothole detection.
- **Kumail Abbas, Deployment and QA Engineer:** Hosting, testing, and documentation.

Suggested presentation handoffs: Masab introduces the problem and demonstrates the interface; Syed explains the AI; Kumail covers testing and limits. Rehearse these handoffs within the video time limit.

## Submission checklist

The team confirmed these requirements: a publicly accessible GitHub repository, a working deployed web app with functional AI, a 3–5-minute demonstration video, and final Google Form submission before **4 PM PKT**. Verify actual inference on the deployed app, not only the local machine.

- Public application URL: **TODO**.
- Demonstration video URL: **TODO**.
- Official Google Form URL and final submission confirmation: **TODO**.

## Before the judges arrive

- Open the local app and check that the API is connected and real analysis works.
- Keep a real pothole photograph ready. The previously tested sample is under `backend/.cache/pothole-road.jpg` on the development machine. It is not included in Git.
- Prepare coordinates you can type quickly. If the photograph's true location is unknown, clearly call them demonstration coordinates. Do not present a sample image as a verified local road.
- Keep the actual negative control ready only if there is spare time.
- Do not replace a failed live request with a mock result. If needed, show a real previously saved report and say it is saved evidence.
- Confirm presentation handoffs. Complete the deployment, video, and Google Form checklist above before the deadline.

## 1. Opening: 20 seconds

> A photograph can show a damaged road. But an inspector still has to answer two questions: what should I look at, and where was this taken? RoadLens AI connects a road photo, possible potholes, and a location in one simple inspection record.

Pause briefly, then point to the app.

## 2. Our solution: 30 seconds

> We built a small web app for a road inspector or maintenance team. Upload a photograph, let a pretrained vision model highlight possible potholes, and review the boxes. Then enter the location and save the inspection on a map. You can click the marker to revisit the report. Today, it works locally in one browser. We are demonstrating that complete workflow, not claiming a finished municipal system.

## 3. Live demonstration: 2 minutes

### 0:00 to 0:25: Upload

**Do:** Choose the real road photograph and show the preview. Click **Analyze road** once.

> This is the photo we are asking the model to inspect. The app sends this actual image to our FastAPI backend. The results are not prewritten boxes.

### 0:25 to 1:00: Review the real result

**Do:** Point to the main visible pothole and its box. Read the score actually shown. Do not promise a fixed detection count or score before the request finishes.

> The model has highlighted this possible pothole. This number is its confidence score for that detection. It is not our overall accuracy. An inspector still needs to review the photograph.

**If the known hills/sky false positives appear, point them out briefly.**

> These boxes over the hills are mistakes. That is why we say “possible potholes” and keep a person in the loop.

### 1:00 to 1:30: Locate and save

**Do:** Enter latitude and longitude. Click **Save inspection** and show the confirmation.

> The location is entered by the inspector. The model does not determine GPS coordinates. For this sample, these are demonstration coordinates, not a verified location from the photograph. Saving keeps a small image thumbnail and the findings in this browser.

If using verified coordinates for your own photograph, replace the demonstration-coordinate sentence with the truthful source of those coordinates.

### 1:30 to 2:00: Show the map and report

**Do:** Scroll to the map. Click the saved marker, then **View inspection**. Show the thumbnail, coordinates, and findings.

> Here is the inspection on the map. Clicking it brings the photograph and findings back together. That is the complete flow: photo, AI review, saved location, and a report we can revisit. This record is local to this browser; it has not been sent to a municipal department.

## 4. What the AI does: 30 seconds

> The AI is used when we analyze the photograph. We use an existing pothole detector that has already been trained. It proposes boxes and scores, and our app draws those boxes over the image. We did not train a new model during the hackathon. It runs on the backend CPU. The map and report storage are ordinary application features. The inspector supplies the location and makes the final judgment.

## 5. Limits and next steps: about 25 seconds

> Today, the model can make mistakes, locations are manual, and reports stay in one browser. We do not schedule repairs. A useful next step would be testing on local road photographs, then adding shared reports and repair-team review. We would measure whether that improves inspection work before claiming an impact. We also need to resolve the model's conflicting license information before public deployment.

Close with:

> RoadLens AI gives an inspector a photo, a place, and a starting point for review.

## 6. Five likely judge questions

### Why not just use ChatGPT?

ChatGPT can help discuss an image. Our task needs boxes in precise image coordinates and a simple inspection-to-map workflow. A dedicated pothole detector gives us those structured results directly. Our app does not call ChatGPT for detection. We have not run a comparison, so we do not claim better accuracy than ChatGPT.

### Where exactly is AI used?

In the **Analyze road** step. The backend runs a real pretrained object detector on the uploaded photograph. It returns proposed pothole boxes and confidence scores. Location entry, saving, and mapping do not use AI.

### Is it accurate?

We have verified that the real model runs and returns boxes. One tested pothole photo produced five detections, including the main pothole at about 91% confidence, but it also produced clear false positives over hills. A street-photo control returned none. That is functional evidence, not a measured accuracy rate. We need a larger, representative local test set before making an accuracy claim.

### Are the locations automatic?

No. The inspector enters latitude and longitude. We validate the ranges, then place the marker at those coordinates. We do not currently read GPS or location metadata from the image. A valid coordinate is not proof of the photograph's true location.

### How could a municipality use this?

A field inspector could review photos and keep mapped records for follow-up. The current prototype supports one browser, not a department-wide service. A municipal pilot would need shared storage, access controls, a review process, and field validation. Repair scheduling would be a separate future integration. We have not claimed a municipal partnership or adoption.

## Evidence and wording to keep consistent

- Say **“possible potholes”**, **“pretrained model”**, and **“locally demonstrated prototype.”**
- Do not call model confidence “accuracy” or claim the model confirms road safety.
- Do not claim crash reduction, repair-time savings, field trials, users, or partnerships without evidence.
- Saved reports retain compressed thumbnails, not original full-resolution photographs.
- A public app URL and demo video remain TODOs until they exist and have been checked.
- Model credit: PeterHdd's YOLOv8s pothole detector, running through ONNX Runtime. Its model card says Apache-2.0, while the ONNX file metadata says AGPL-3.0. This remains unresolved.
- Technical test details: [backend results](../backend/TEST_RESULTS.md). Setup and environment settings: [README](../README.md).
