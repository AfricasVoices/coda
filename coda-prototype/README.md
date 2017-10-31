# Coda

Coda is an interactive tool that helps you label short text datasets!

![Coda](data/img/coda2.png "Coda")


## Usage

#### Coding
You can code each message by using the dropdown menu or by using a shortcut which you can assign via the **Scheme Editor**.
Editor can be reached via the *edit scheme button* in the table header. You can also use the editor to assign a colour to each code, as well as add words typical for each code.

Words you've assigned to each code will be used by Coda to try and help you by attempting to *automatically* code each of the messages.
This is triggered either via saving the edits to a coding scheme or using the *Auto-code* button in the navigation bar.

You can add new coding schemes via the *Add new scheme button* on the right-hand side. Once you're working with multiple coding schemes, you can set the *active scheme by clicking on its name. The shortcuts for the active scheme will then be activated, dropdowns enabled and the messages recoloured.

#### Keeping the scheme changes
Words, colours and shortcuts count as extra data for a coding scheme and won't automatically get recreated when you import a dataset that already contains labels/code assignments. A coding scheme will therefore only be recreated in its *dry* version. To be able to keep the words, colours and shortcuts you've assigned to each of the codes, *export* each coding scheme via the *download scheme button* in Scheme Editor. You can reuse that file later and import it again via *upload scheme* button in Scheme Editor.

#### Keeping the code assignments

Coda uses Chrome internal storage to save your progress between coding sessions. Changes are automatically saved every couple of steps, but you can also make a save manually by using the *Save button* in the navbar.

The data stored internally uses a custom datastructure, so in order to view the coded data as a spreadsheet it will have to be exported from Coda first.
This is achieved via *Export dataset* in the Dataset menu, and running a Python *conversion script* on the exported CSV file to reach their correct final form.

Data can then be edited within a spreadsheet editor and re-imported to Coda. First by running a Python *conversion script* to reach the correct form for import and then importing extra data for each scheme (words, colours, shortcuts) via Scheme Editor.

#### Formats

Coda supports semi-colon separated CSV files. It doesn't force you to use preset column names for the CSV file - you can use whichever names you prefer when working in a spreadsheet editor. However, this means a conversion script has to be run on the CSV file to unify the column names with Coda's internal datastructures. The CSV conversion scripts ask for mappings of your custom column names to standardised internal column names.

There is no need to convert the coding scheme files, as they are small, straightforward to edit and using obvious column names.

## Installation & Updating

Coda functions as a Chrome extension - while still operating completely offline, this greatly simplifies installation and support for multiple platforms.

#### Installation

If you're setting up Coda for the first time, these are the steps to follow:

0. Download a zip file of Coda's repository on GitHub
1. open Chrome and navigate to chrome://extensions/ (just type it in the URL address bar)
2. tick the “Developer Mode” checkbox on top
3. click on the “Load unpacked extension…” button that pops up below
4. open the unzipped folder

A new icon should then show up next to the Chrome address bar and Coda can be accessed from there!

---

#### Uninstalling
To uninstall Coda, just navigate to the same place (chrome://extensions/), click the trashcan icon next to Coda and untick Developer Mode on top.

---

#### Updating

If you have an old version of Coda installed and want to update it with a new version, follow the steps below:

0. Export & save the coding and instrumentation files via navigation menu, coding scheme files via Scheme Editor
1. unzip the update files
2. open Chrome and navigate to chrome://extensions/ (just type it in the URL address bar)
3. find AVF Prototype or Coda on the extension list
4. find and open the location where Coda is saved by clicking on the link “Loaded from:” 
5. empty the “Loaded from:” folder, but keep the folder itself
6. paste the just unzipped content of the folder (note: just the content, and not the folder itself) in step 1. to the “Loaded from:” folder, replacing all the content.
7. navigate to chrome://extensions/ again, find AVF Prototype/Coda, and click “Reload”.
8. launch Coda again as usual

---

###### **PLEASE NOTE**:
Updating by uninstalling the app (clicking on the trashcan icon) and then reinstalling the new version will ***WIPE*** Coda’s internal storage. Unless you have already exported all coding data, **don’t** do this when updating Coda to a new version.

## Developer Setup

Note: All commands below should be run from the coda-prototype directory, unless otherwise specified.

#### Dependencies
Some dependencies are already included in the git repository, inside the directory external/.

To install the remaining dependencies: `$ npm install`

#### Typescript Compiler
Coda's source is written in a mix of TypeScript and Javascript, located in src/. We are in the process of  migrating all 
JavaScript files to TypeScript. TypeScript files must be compiled to JavaScript in order to run them. Modern IDEs will
compile TypeScript automatically. Invoke `$ tsc` to re-compile manually. Compiled code is placed in the dist/ directory.

#### Testing
The test suites for Coda are written using Jasmine, and executed by Karma.

---

To run the test suites from the command line:
1. Install dependencies: `$ npm install`
2. Ensure all test files are up to date: `$ tsc`
2. Install the command line interface for karma: `$ npm install -g karma-cli`
3. Run the suite: `$ karma start`

Karma will execute all tests and print the results to the command line.

---

To run the test suites from within WebStorm:
1. Install dependencies: `$ npm install`
2. Right-click 'karma.conf.js' in the project explorer, and choose "Create karma.conf.js..."
3. Accept all defaults, and Run.

#### Deployment
Coda is distributed via zip files which are made available on the releases page of the GitHub repository.

To generate a new zip file: `$ sh deploy.sh`

This will update dependencies and re-compile all TypeScript files, then compress the current coda-prototype directory
into coda.zip. If the current file system matches HEAD, the commit hash of HEAD will be appended to the zip file name, 
and also displayed on Coda's UI. Otherwise, deploy.sh will emit a warning. *Do not release a version of Coda which does 
not have a hash.*
