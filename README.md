# nprinting-sense-on-demand
NPrinting On-demand extension for Qlik Sense.

Tested on Qlik Sense November 2018.

# Get Started

## Installation
1. Download the extension zip, `qlik-on-demand-reporting.zip`, from the latest release (https://github.com/qlik-oss/nprinting-sense-on-demand/releases/latest)
2. Install the extension:

    a. **Qlik Sense Desktop**: unzip to a directory under [My Documents]/Qlik/Sense/Extensions.
    
    b. **Qlik Sense Server**: import the zip file in the QMC.

## Usage

1.Drag in extension onto your sheet.

2.Configure NPrinting Server host name with '/' at the end, such as https://nprinting.test.local:4993/

3.Choose an app from the following dropbox

![alt tag](https://github.com/bohua/nprinting-sense-on-demand/blob/master/tutorial/1_3.png)

4.Pick your report in "Report Configuration" Section

5.And choose your expected export format

![alt tag](https://github.com/bohua/nprinting-sense-on-demand/blob/master/tutorial/4_5.png)

6.Go to Analysis Mode and Press the button to start report generation

![alt tag](https://github.com/bohua/nprinting-sense-on-demand/blob/master/tutorial/6.png)

7.Popup window will show up and auto pulling the status of the generation.

![alt tag](https://github.com/bohua/nprinting-sense-on-demand/blob/master/tutorial/7.png)

8.When reported is generated on NPrinting server, the download button will appear. Click the button to download your report.

![alt tag](https://github.com/bohua/nprinting-sense-on-demand/blob/master/tutorial/8.png)

# Developing the extension

If you want to do code changes to the extension follow these simple steps to get going.

1. Get Qlik Sense Desktop
1. Create a new app and add qsVariable to a sheet.
2. Clone the repository
3. Run `npm install`
4. Change the path to `/dist` folder in `gulpfile.js(row 8)` to be your local extensions folder. It will be something like `C:/Users/<user>/Documents/Qlik/Sense/Extensions/qlik-multi-kpi`.
5. Run `npm run build:debug` - this command should output unminified code to the path configured in step four.

```
// Minified output to /dist folder.
$ npm run build
```

```
// Outputs a .zip file to /dist folder.
$ npm run build:zip
```

# Original Author
[bohua](https://github.com/bohua)

For any questions and support, please feel free to contact:

Bohua Li (bl@s-cubed.dk)
