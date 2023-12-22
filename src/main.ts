import * as path from 'path';
import { App, Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as stepFunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { TaskJob } from './task-job';


export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'demoVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'public',
        subnetType: ec2.SubnetType.PUBLIC,
      }],
    });

    const ecsCronJobSG = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      allowAllOutbound: true,
      securityGroupName: 'ecs-cron-job',
    });
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'ecs-cron-job',
      vpc,
    });
    const task = new TaskJob(this, 'TaskJob', {
      familyName: 'ecs-cron-job',
    });

    // Optional 1: use lambda
    const checkerHandler = new lambdaNodejs.NodejsFunction(this, 'CheckerHandler', {
      functionName: `${Stack.of(this).stackName}-CheckerHandler`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, './lambda/checker.ts'),
      handler: 'handler',
      bundling: {
        keepNames: true,
        externalModules: ['@aws-sdk/client-ecs'],
      },
      environment: {
        Family: task.taskDefinition.family,
        Cluster: cluster.clusterName,
      },
      timeout: Duration.seconds(60),
      memorySize: 512,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ['ecs:ListTasks'],
          resources: ['*'],
        }),
      ],
    });

    const checkerHandlerNumber = new sfTasks.LambdaInvoke(this, 'CheckerHandlerNumber', {
      lambdaFunction: checkerHandler,
      payloadResponseOnly: true,
    });

    const choice = new stepFunctions.Choice(this, 'Need to run ECS task ?!', {
      inputPath: '$',
    });

    const ecsRunTask = new sfTasks.EcsRunTask(this, 'EcsRunTask', {
      cluster: cluster,
      taskDefinition: task.taskDefinition,
      securityGroups: [ecsCronJobSG],
      subnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
      launchTarget: new sfTasks.EcsFargateLaunchTarget(),
      assignPublicIp: true,
    });

    choice.when(stepFunctions.Condition.numberGreaterThanEquals('$.RUNNING', 1),
      new stepFunctions.Succeed(this, 'Not need start ECS Task, Done')).when(
      stepFunctions.Condition.numberEquals('$.ERRORCODE', 99999), new stepFunctions.Fail(this, 'Not need start ECS Task, Something error!!!'),
    ).when(stepFunctions.Condition.numberLessThan('$.RUNNING', 1),
      ecsRunTask);

    const machine = new stepFunctions.StateMachine(this, 'StateMachine', {
      stateMachineName: 'DemoStateMachineName',
      definitionBody: stepFunctions.DefinitionBody.fromChainable(checkerHandlerNumber.next(choice)),
    });
    new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.rate(Duration.days(1)),
      targets: [new targets.SfnStateMachine(machine)],
    });

    // Optional 2
    const listTasks = new sfTasks.CallAwsService(this, 'callListTasks', {
      service: 'ecs',
      action: 'listTasks',
      parameters: {
        Cluster: cluster.clusterName,
        Family: task.taskDefinition.family,
        DesiredStatus: 'RUNNING',
      },
      iamResources: ['*'],
      resultSelector: {
        length:
        /**
         * @ note: !!!
         * Do not use stepFunctions.JsonPath.arrayLength('$.TaskArns')
         * you will fail format
         * Use stepFunctions.JsonPath.arrayLength(
         * stepFunctions.JsonPath.stringAt('$.TaskArns')
         * )
        */
        stepFunctions.JsonPath.arrayLength(
          stepFunctions.JsonPath.stringAt('$.TaskArns'),
        ),
      },
    });

    const ecsRunTask2 = new sfTasks.EcsRunTask(this, 'EcsRunTask2', {
      cluster: cluster,
      taskDefinition: task.taskDefinition,
      securityGroups: [ecsCronJobSG],
      subnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
      launchTarget: new sfTasks.EcsFargateLaunchTarget(),
      assignPublicIp: true,
    });

    const choice2 = new stepFunctions.Choice(this, 'Need to run ECS task !?', {
      inputPath: '$',
    });

    choice2.when(stepFunctions.Condition.numberGreaterThanEquals('$.length', 1),
      new stepFunctions.Succeed(this, 'Not need to start ECS Task, Done'))
      .when(stepFunctions.Condition.numberLessThan('$.length', 1),
        ecsRunTask2);

    const machine2 = new stepFunctions.StateMachine(this, 'StateMachine2', {
      stateMachineName: 'DemoStateMachineName2',
      definitionBody: stepFunctions.DefinitionBody.fromChainable(listTasks.next(choice2)),
    });

    new events.Rule(this, 'ScheduleRule2', {
      schedule: events.Schedule.rate(Duration.days(1)),
      targets: [new targets.SfnStateMachine(machine2)],
    });
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'schedule-stepfunctions-run-ecs-task-dev', { env: devEnv });

app.synth();

//.tasks[0].containers[0].exitCode