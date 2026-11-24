
# Quiet Care — Smart-Home Monitoring Simulator

**Module:** LZSCC.241 — Human-Computer Interaction  
**Project:** #5 — Quiet Care (Modified)  
**University:** Lancaster University Leipzig  
**Status:** Interactive prototype completed — further development in progress  
**Last updated:** 24 November 2026  

## Live Prototype

**[Launch Quiet Care Simulation](https://zeyadzido1-alt.github.io/HCI_GP_AB1/)**

The current prototype runs directly in a web browser without requiring additional software or physical hardware.

## Project Overview

Quiet Care is a browser-based interactive smart-home simulation exploring how carers identify and respond to safety risks involving older adults living alone.

Following positive lecturer feedback, the group prioritized the development of the animated home simulation before introducing household incidents, simulated sensors, severity-based alerts and caregiver monitoring functionality.

## Research Question

How effectively can a smart-home system use severity-based alerts to help carers identify and respond to risks involving older adults living alone, while maintaining trust and minimizing intrusiveness?

## Current Prototype

The first interactive prototype was presented on 17 November 2026.

### Implemented Features

- Isometric four-room apartment containing a bedroom, bathroom, kitchen and living room.
- Interactive older resident with keyboard-controlled movement.
- Collision detection and environmental interactions.
- Sleeping and waking functionality.
- Day, sunset and night cycles.
- Simulation session tracking and results screen.
- Browser-based deployment through GitHub Pages.

### Planned Features

- Automated daily routine.
- Randomized household safety incidents.
- Simulated household sensors.
- Severity-based alerts and notifications.
- Caregiver monitoring interface and response options.
- Automatic interaction logging and CSV export for evaluation.

## Development Roadmap

| Phase | Target Date | Status |
|---|---|---|
| Project planning and initial research | 8 November | Completed |
| Initial interactive prototype | 17 November | Completed |
| Automated simulation and incident development | 29 November | In progress |
| Evaluation-ready prototype | 6 December | Planned |
| Participant testing and results analysis | 13 December | Planned |
| Final presentation | 15 December | Planned |
| Internal project completion | 17 December | Planned |
| Final report and code submission | 18 December | Planned |

Development targets are subject to group agreement and prototype readiness.

## Technology

| Technology | Purpose |
|---|---|
| HTML | Application structure |
| CSS | Interface styling and visual presentation |
| JavaScript | Simulation logic and interactions |
| SVG | Apartment, character and environmental graphics |
| GitHub Pages | Live prototype deployment |
| GitHub Issues and Projects | Task and progress management |
| GitHub Wiki | Project documentation |

All household incidents and sensors are simulated. No physical sensors or additional hardware are required.

## Repository Structure

    HCI_GP_AB1/
    ├── grandma-apartment/
    │   ├── assets/
    │   ├── index.html
    │   ├── style.css
    │   ├── game.js
    │   └── README.md
    ├── index.html
    └── README.md

The grandma-apartment directory contains the simulation implementation. The root index.html provides access to the prototype through GitHub Pages.

## Running the Prototype

### Online

Open the [live simulation](https://zeyadzido1-alt.github.io/HCI_GP_AB1/).

### Locally

Clone or download this repository and open grandma-apartment/index.html in a web browser. If required, serve the directory using a local development server.

## Evaluation

The project will evaluate the effectiveness and usability of smart-home alerts through participant testing.

The proposed evaluation measures include:

- Response accuracy.
- Response time.
- Alert appropriateness.
- Trust.
- Perceived intrusiveness.
- Overall usability.

We aim to recruit between five and ten participants.

The detailed experimental conditions, evaluation methodology and data collection requirements are documented in the User Evaluation Wiki page and remain subject to revision.

## Team

| Member | Role |
|---|---|
| Zeyad | Project Manager; Documentation Co-Lead |
| Yousef | Research Lead; Documentation Co-Lead |
| Victor | Design Lead; Implementation Co-Lead |
| Maria | Implementation Co-Lead |
| Patrick | Evaluation Lead |

## Project Documentation

| Page | Description |
|---|---|
| [Wiki Home](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki) | Project overview and navigation |
| [Project Plan](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki/Project-Plan) | Development phases and objectives |
| [Research and Requirements](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki/Research-and-Requirements) | Background research and system requirements |
| [Design and Prototyping](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki/Design-and-Prototyping) | Design decisions and prototype development |
| [User Evaluation](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki/User-Evaluation) | Evaluation methodology and results |
| [Team Roles and Contributions](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki/Team-Roles-and-Contributions) | Team responsibilities |
| [Weekly Progress Logs](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki/Weekly-Progress-Logs) | Weekly progress and individual contributions |
| [Meeting Notes and Decisions](https://github.com/zeyadzido1-alt/HCI_GP_AB1/wiki/Meeting-Notes-and-Decisions) | Group decisions and milestones |

## Project Management

- [GitHub Issues](https://github.com/zeyadzido1-alt/HCI_GP_AB1/issues)
- [Project Board](https://github.com/users/zeyadzido1-alt/projects/1)

## AI Assistance Disclosure

AI tools may be used to support planning, documentation and implementation. Any AI assistance will be disclosed in the final report, and all team members remain responsible for understanding and verifying their contributions.
