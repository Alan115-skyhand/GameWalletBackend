import mysql from "mysql2/promise";
import { generateConditionExpression, generateId, getEventBody } from "../resources/Utils";
import Decimal from "decimal.js";
import { dynamoDBDocumentClient, assetStreamClient } from "../resources/Clients"
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi"
import { textEncoder } from "../resources/Tools"
const unit = require("ethjs-unit");

export async function handler(event: any) {
  // const txData = JSON.parse(event.Records[0].Sns.Message)[0];
  const txData = getEventBody(event);
  // const txData = {
  //   chainId: "0x5",
  //   txs: [
  //     {
  //       hash:
  //         "0x7d49a60e3e26e02c2ed315e0eb123216c9d526ac54bfefd6a59156f78deca8e7",
  //       gas: "21000",
  //       gasPrice: "46719536202",
  //       nonce: "172",
  //       input: "0x",
  //       transactionIndex: "139",
  //       fromAddress: "0x775808cb53f5f419fe22e7c7bf48234c88628192",
  //       toAddress: "0x775808cb53f5f419fe22e7c7bf48234c88628192",
  //       value: "10000000000000",
  //       type: "2",
  //       v: "0",
  //       r:
  //         "87140225145848601411075880929369468188693374221829103449947565891441161662559",
  //       s:
  //         "36195842966622358044585997305921151636801281900485740501947973778165979064836",
  //       receiptCumulativeGasUsed: "21555884",
  //       receiptGasUsed: "21000",
  //       receiptContractAddress: null,
  //       receiptRoot: null,
  //       receiptStatus: "1",
  //     },
  //   ],
  // };

  let request: any = {};
  let hash: string = "";
  let amount: number = 0;
  let to = "";
  let tokenContract = "";

  if(txData.subscriptionType === "ADDRESS_TRANSACTION") {
    request = txData;
    hash = request.txId;
    amount = parseFloat(request.amount);
    to = request.address;
    tokenContract = request.asset ?? ""
  }
  else {
    if (txData.txs?.length) {
      request = txData.txs[0];
      hash = request.hash;
      amount = parseFloat(unit.fromWei(request.value, "ether"));
      to = request.toAddress;
    }
    if (txData.erc20Transfers?.length) {
      request = txData.erc20Transfers[0];
      hash = request.hash;
      amount = parseFloat(request.valueWithDecimals);
      to = request.to;
    }
    tokenContract =request.contract ?? ""
  }

  if (!amount) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: "Invalid Data",
      }),
    };
  }

  if (Number.isNaN(amount)) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: "Invalid Amount",
      }),
    };
  }

  if (amount < 0) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: "withdraw from this account",
      }),
    };
  }

  const response = await dynamoDBDocumentClient.scan({
    TableName: "CryptoAssetStreamConnections",
    // IndexName: "CryptoTradeStreamConnectionsUserIndex",
    // FilterExpression: "#user = :user",
    // ExpressionAttributeNames: {
    //     "#user": "user"
    // },
    // ExpressionAttributeValues: {
    //     ":user": update.user
    // }
  });
  const connections = response.Items ?? []

  // await dynamoDBDocumentClient.put({
  //   TableName: "User",
  //   Item: {
  //     id: Date.now().toString(),
  //     data: JSON.stringify(txData),
  //   }
  // });


  if ("confirmed" in txData && !txData.confirmed) {
    for (const connection of connections) {
      await assetStreamClient.send(new PostToConnectionCommand({
        ConnectionId: connection.connectionId,
        Data: textEncoder.encode(JSON.stringify({status: "not-confirmed"}))
      })).catch((e) => {
        console.log(e);
        dynamoDBDocumentClient.delete({
          TableName: "CryptoAssetStreamConnections",
          Key: {
            "connectionId": connection.connectionId
          }
        })
      })
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        deposit: {status: "not-confirmed"},
      }),
    };
  }

  const net = await dynamoDBDocumentClient
    .scan({
      TableName: "Net",
      FilterExpression: "#chain_id = :chainId",
      ExpressionAttributeNames: {
        "#chain_id": "chain_id",
      },
      ExpressionAttributeValues: {
        ":chainId": parseInt(txData.chainId).toString(),
      },
    })
    .then((response: any) => response.Items[0] ?? null);

  const wallet = await dynamoDBDocumentClient
    .scan({
      TableName: "CryptoWallets",
      FilterExpression: "#address = :address AND #net_id = :net_id",
      ExpressionAttributeNames: {
        "#address": "public_key",
        "#net_id": "net_id",
      },
      ExpressionAttributeValues: {
        ":address": to,
        ":net_id": net.id,
      },
    })
    .then((response: any) => response.Items[0] ?? null);

  const tokens = await dynamoDBDocumentClient
    .scan({
      TableName: "CryptoSupportedAssets",
    })
    .then((response: any) => response.Items ?? []);

  const token = tokens.find(
    (t: any) => t.address[net.id] === (tokenContract)
  );

  const asset = dynamoDBDocumentClient.get({
    TableName: "CryptoAssets",
    Key: {
      user_id: wallet?.user_id,
      token_id: token?.id,
    },
  });

  if (!(await asset).Item) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: "no such asset supports",
      }),
    };
  }

  const previousAmount = await asset
    .then((response) => response.Item)
    .then((asset) => asset?.amount ?? "0")
    .then((amount) => new Decimal(amount));
  const depositAmount = new Decimal(amount);
  const totalAmount = previousAmount.plus(depositAmount);

  if (depositAmount.isNegative() || depositAmount.isZero()) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: "Invalid Amount",
      }),
    };
  }

  const conditionExpression = generateConditionExpression(
    "#amount",
    "=",
    ":previousAmount",
    previousAmount.isZero() ? undefined : previousAmount.toString()
  );

  const updateExpression = "SET #amount = :totalAmount";

  await dynamoDBDocumentClient.update({
    TableName: "CryptoAssets",
    Key: {
      user_id: wallet.user_id,
      token_id: token.id,
    },
    ConditionExpression: conditionExpression,
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: {
      "#amount": "amount",
    },
    ExpressionAttributeValues: {
      ":previousAmount": previousAmount.isZero()
        ? undefined
        : previousAmount.toString(),
      ":totalAmount": totalAmount.toString(),
    },
  });

  const curr_time = Date.now();

  const deposit = {
    id: generateId(),
    hash,
    user_id: wallet.user_id,
    net_id: net.id,
    token_id: token.id,
    amount: amount,
    time: curr_time,
    status: "confirmed",
    type: "deposit",
  };

  await dynamoDBDocumentClient.put({
    TableName: "CryptoDeposits",
    Item: deposit,
  });

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PW,
    database: process.env.DATABASE_NAME,
  });

  const query = `INSERT INTO ${process.env.DATABASE_NAME} (user_id, hash, address, token_id, net_id, type, amount, state, created_at) VALUES('${wallet.user_id}', '${hash}', '${to}', '${token.id}', '${net.id}', 'deposit', ${amount}, 'success', FROM_UNIXTIME(${curr_time / 1000}))`;
  const [rows, fields] = await connection.execute(query);

  for (const connection of connections) {
    await assetStreamClient.send(new PostToConnectionCommand({
      ConnectionId: connection.connectionId,
      Data: textEncoder.encode(JSON.stringify(deposit))
    })).catch((e) => {
      console.log(e);
      dynamoDBDocumentClient.delete({
        TableName: "CryptoAssetStreamConnections",
        Key: {
          "connectionId": connection.connectionId
        }
      })
    })
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      success: true,
      deposit: deposit,
    }),
  };
}
