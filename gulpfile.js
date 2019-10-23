const { watch } = require('gulp');
const yaml = require('yaml');
const fs = require('fs');
const { strOptions } = require('yaml/types');
const {exec} = require('child_process');

strOptions.defaultType = 'QUOTE_DOUBLE'

function defaultTask(cb) {
  // place code for your default task here
  console.log('called');
  cb();
}



function watchFiles(cb) {
  watch(['**/*.js','**/*.json'], function (cb) {
    // body omitted
    createYaml(cb);
    const packageData = fs.readFileSync('package.json');
    const packageJson = JSON.parse(packageData);
    console.log("Deploying changes...");
    exec(`kubectl apply -f ${packageJson.name}.yaml`, (err, stdout, stderr) => {
       if (err) {
         console.error(err);
       } else {
         if (stdout)
          console.log(`Successfully deployed: ${stdout}`);
         if (stderr)
          console.log(`${stderr}`);
       }
    });
    cb();
  });
}

function createYaml(cb) {
  console.log('Creating yaml....');

  const packageData = fs.readFileSync('package.json');
  const packageJson = JSON.parse(packageData);

  if (!packageJson.name) {
    console.error("Error: no name found in package.json");
    process.exit(1);
  }
  if (!packageJson.main) {
    console.error("Error: value for main not found in package.json, set to the filename of your script");
    process.exit(1);
  }

  if (!fs.existsSync(packageJson.main)) {
    console.error(`Error: no source file found for ${packageJson.main}, set in package.json`);
    process.exit(1);
  }

  var envVarsDataJson;
  if (fs.existsSync('envvars.json')) {
    const envVarsData = fs.readFileSync('envvars.json');
    envVarsDataJson = JSON.parse(envVarsData);
  }
  else {
    console.log("No environment variables found (envvars.json)");
  }

  const javascriptFunc = fs.readFileSync(packageJson.main).toString();

  var functionYaml = {
    "apiVersion": "kubeless.io/v1beta1",
    "kind": "Function",
    "metadata": {
      "labels": {
        "app": packageJson.name
      },
      "name": packageJson.name
    },
    "spec": {
      "deployment": {
        "spec": {
          "template": {
            "spec": {
              "containers": [{
                "env": [],
                "name": packageJson.name
              }]
            }
          }
        }
      },
      "deps": JSON.stringify(packageJson, null, 2),
      "function": javascriptFunc,
      "runtime": "nodejs8",
      "type": "HTTP",
      "handler": "handler.main"
    }
  }
  var i = 0;
  if (envVarsDataJson) {
    for (varName in envVarsDataJson) {
      functionYaml.spec.deployment.spec.template.spec.containers[0].env[i] = { "name": varName, "value": envVarsDataJson[varName] }
      i++
    }
  }
  //console.log(yaml.stringify(functionYaml));
  fs.writeFileSync(`${packageJson.name}.yaml`, yaml.stringify(functionYaml));
  cb();
}

exports.watch = watchFiles
exports.build = createYaml
exports.default = defaultTask
