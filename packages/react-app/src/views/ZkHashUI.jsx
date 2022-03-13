/* global BigInt */
import React, { useState, useEffect } from "react";
import { Card, Collapse, InputNumber, Button, Tabs, Divider, Result, Typography, message, Row, Col } from "antd";
import ReactJson from 'react-json-view';
import {
  parseGroth16ToSolidityCalldata,
  parsePlonkToSolidityCalldata
} from "../helpers";
const circomlibjs = require("circomlibjs");
const snarkjs = require("snarkjs");

const mimcsponge = circomlibjs.mimcsponge;
// const bigInt = snarkjs.BigInt;

const { Text } = Typography;
const { Panel } = Collapse;

// const textToBinary = (str = '') => {
//   let res = '';
//   res = str.split('').map(char => {
//     return char.charCodeAt(0).toString(2);
//   }).join('');
//   return res;
// };

export default function ZkHashUI({
  protocol,
  wasm,
  zkey,
  vkey,
  scVerifyFn,
}) {

  if (!protocol) protocol = "groth16";

  const [input, setInput] = useState(0);
  const [hash, setHash] = useState(mimcsponge.multiHash([0]).toString());

  const [zkProof, setZkProof] = useState();
  const [zkSignals, setZkSignals] = useState();
  const [solCalldata, setSolCalldata] = useState();

  const [localVerifyResult, setLocalVerifyResult] = useState();
  const [contractVerifyResult, setContractVerifyResult] = useState();

  async function proveInputs() {
    console.log("Calculating Proof! ...")
    const { proof, publicSignals } = await snarkjs[protocol].fullProve({x: input, hash: hash}, wasm, zkey);

    let calldata;
    if (protocol === "groth16") calldata = parseGroth16ToSolidityCalldata(proof, publicSignals);
    if (protocol === "plonk") calldata = await parsePlonkToSolidityCalldata(proof, publicSignals);

    setZkProof(proof);
    setZkSignals(publicSignals);
    setSolCalldata(calldata);
  }

  async function verifyProof() {
    if (!vkey) {
      vkey = await snarkjs.zKey.exportVerificationKey(zkey);
    }
    const verified = await snarkjs[protocol].verify(vkey, zkSignals, zkProof);
    return verified;
  }

  return (
    <div style={{ margin: "auto", width: "52vw" }}>
      <div style={{textAlign: "left", paddingTop: "2%"}}>
        <h3>Input:</h3>
      </div>
      <div style={{padding: "1%", width: "48vw"}}>
        <InputNumber
          style={{width: "48vw" }}
          defaultValue={0}
          onChange={(v) => {
            if (localVerifyResult) setLocalVerifyResult(undefined);
            if (contractVerifyResult) setContractVerifyResult(undefined);
            v ? v=v : v=0;

            setInput(v);
            setHash(mimcsponge.multiHash([v]).toString());
          }}
        />
      </div>
      <div style={{padding: "1%"}}>
        <Text>{input}</Text>
      </div>
      <div style={{textAlign: "left", paddingTop: "1%"}}>
        <h3>Hash from Input:</h3>
      </div>
      <div style={{padding: "3%"}}>
        <Text>{hash}</Text>
      </div>
      <div style={{padding: "2%"}}>
        <Button
          type="primary"
          onClick={proveInputs}
        >
          Prove
        </Button>
      </div>
      <div>
        <Row gutter={[150, 10]} justify="center">
          <Col span={10}>
            <Result
              status={localVerifyResult == undefined ? undefined : localVerifyResult ? "success" : "error"}
              subTitle={localVerifyResult == undefined ? "Unverified locally" : localVerifyResult ? "Verified locally" : "Invalid proof"}
              extra={
                <Button
                  type="primary"
                  ghost={localVerifyResult == undefined ? false : true}
                  onClick={
                    async () => {
                      try {
                        let res = await verifyProof();
                        setLocalVerifyResult(res);
                      } catch (err) {
                        console.error(err);
                        message.error("Something is not right here", 3);
                      }
                    }
                  }
                >
                  Verify
                </Button>
              }
            />
          </Col>
          <Col span={10}>
            <Result
              status={contractVerifyResult == undefined ? undefined : contractVerifyResult ? "success" : "error"}
              subTitle={contractVerifyResult == undefined ? "Unverified by contract" : contractVerifyResult ? "Verified by contract" : "Invalid proof"}
              extra={
                <Button
                  type="primary"
                  ghost={contractVerifyResult == undefined ? false : true}
                  onClick={
                    async () => {
                      try {
                        let res = await scVerifyFn(...solCalldata);
                        setContractVerifyResult(res);
                      } catch (err) {
                        console.error(err);
                        message.error("Something is not right here", 3);
                      }
                    }
                  }
                >
                  Verify
                </Button>
              }
            />
          </Col>
        </Row>
      </div>
      <div style={{textAlign: "left"}}>
        <Collapse>
          <Panel header={protocol + " Proof"}>
            <div style={{textAlign: "left"}}>
              <ReactJson
                src={zkProof}
                style={{fontSize: "0.7em"}}
                displayArrayKey={false}
                displayDataTypes={false}
              />
            </div>
          </Panel>
          <Panel header="Public Signals">
            <div style={{textAlign: "left"}}>
              <ReactJson
                src={zkSignals}
                style={{fontSize: "0.7em"}}
                displayArrayKey={false}
                displayDataTypes={false}
              />
            </div>
          </Panel>
          <Panel header="Solidity Calldata">
            <div style={{textAlign: "left"}}>
              <ReactJson
                src={solCalldata}
                style={{fontSize: "0.7em"}}
                displayArrayKey={false}
                displayDataTypes={false}
              />
            </div>
          </Panel>
        </Collapse>
      </div>

      <div style={{height: "250px"}}/>
    </div>
  )
}
