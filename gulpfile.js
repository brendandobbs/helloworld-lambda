const { watch } = require('gulp');
const yaml = require('yaml');
const fs = require('fs');
const { strOptions } = require('yaml/types');
const { exec } = require('child_process');

strOptions.defaultType = 'QUOTE_DOUBLE'

function defaultTask(cb) {
  // place code for your default task here
  console.log('called');
  cb();
}

function watchFiles(cb) {
  watch(['**/*.js', '**/*.json'], function autoDeploy(cb) {
    deploy(cb);
  });
}

function deploy(cb) {


  const packageData = fs.readFileSync('package.json');
  const packageJson = JSON.parse(packageData);

  createYaml();

  console.log("Deploying changes...");
  exec(`kubectl apply -f ${packageJson.name}.yaml`, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
    } else {
      if (stdout)
        console.log(`Successfully deployed: ${stdout}`);
      fs.unlinkSync(`${packageJson.name}.yaml`);
      if (stderr)
        console.log(`${stderr}`);
    }
  });
  // check the status of the deployed pod
  sleep(2000).then(() => {
    podStatus(cb);
  });

  // Apply any kubernetes resources
  if (fs.existsSync('k8s') && fs.readdirSync('k8s').length > 0) {
    console.log('Applying k8s resources');
    exec(`kubectl apply -f k8s --recursive`, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
      } else {
        if (stdout)
          console.log(`Successfully applied config: ${stdout}`);
        if (stderr)
          console.log(`${stderr}`);
      }
    });
  }
  cb();
}

function podStatus(cb){

  const packageData = fs.readFileSync('package.json');
  const packageJson = JSON.parse(packageData);

  exec(`kubectl get pods -l app=${packageJson.name}`, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
    } else {
      if (stdout)
        console.log(`${stdout}`);
      if (stderr)
        console.log(`${stderr}`);
    }
  });
  cb();
}

function logs(cb){

  const packageData = fs.readFileSync('package.json');
  const packageJson = JSON.parse(packageData);

  exec(`kubectl logs -l app=${packageJson.name} -c ${packageJson.name} --since=1h`, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
    } else {
      if (stdout)
        console.log(`${stdout}`);
      if (stderr)
        console.log(`${stderr}`);
    }
  });
  cb();
}

function createYaml() {
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
      var val = envVarsDataJson[varName];
      // check if there is a env var override
      if (process.env[varName]) {
        val = process.env[varName];
      }
      functionYaml.spec.deployment.spec.template.spec.containers[0].env[i] = { "name": varName, "value": val }
      i++
    }
  }
  //console.log(yaml.stringify(functionYaml));
  fs.writeFileSync(`${packageJson.name}.yaml`, yaml.stringify(functionYaml));
}

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

exports.watch = watchFiles
exports.deploy = deploy
exports.status = podStatus
exports.logs = logs
