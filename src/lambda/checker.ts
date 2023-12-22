/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
import { ECSClient, ListTasksCommand, DesiredStatus } from '@aws-sdk/client-ecs';

interface ReturnType {
  PENDING: number;
  RUNNING: number;
  STOPPED: number;
  ERRORCODE: number;
}
export async function handler(): Promise<ReturnType> {

  let res: ReturnType = {
    PENDING: 99999,
    RUNNING: 99999,
    STOPPED: 99999,
    ERRORCODE: 99999,
  };
  const family = `${process.env.Family}`;
  const cluster = `${process.env.Cluster}`;
  const client = new ECSClient({
    region: `${process.env.AWS_REGION}`,
  });


  try {
    const PENDING = await client.send(new ListTasksCommand({
      family,
      cluster,
      desiredStatus: DesiredStatus.PENDING,
    }));
    console.log(PENDING);
    res.PENDING = PENDING.taskArns!.length;
    res.ERRORCODE = 0;
    console.log(`${DesiredStatus.PENDING} length: ${PENDING.taskArns!.length}`);
  } catch (error) {
    console.error(error);
  }

  try {
    const RUNNING = await client.send(new ListTasksCommand({
      family,
      cluster,
      desiredStatus: DesiredStatus.RUNNING,
    }));
    console.log(RUNNING);
    res.RUNNING = RUNNING.taskArns!.length;
    res.ERRORCODE = 0;
    console.log(`${DesiredStatus.RUNNING} length: ${RUNNING.taskArns!.length}`);
  } catch (error) {
    console.error(error);
  }

  try {
    const STOPPED = await client.send(new ListTasksCommand({
      family,
      cluster,
      desiredStatus: DesiredStatus.STOPPED,
    }));
    console.log(STOPPED);
    res.STOPPED = STOPPED.taskArns!.length;
    res.ERRORCODE = 0;
    console.log(`${DesiredStatus.STOPPED} length: ${STOPPED.taskArns!.length}`);
  } catch (error) {
    console.error(error);
  }
  if (res.PENDING === 99999|| res.RUNNING === 99999 || res.STOPPED === 99999) {
    res.ERRORCODE = 99999;
    console.log('something error');
  }
  console.log(res);

  // return 0 run ecs task
  // return 1 ~ 99999 do not run ecs task
  // return 99999, something error do not run ecs task;
  return res;
};

void handler();