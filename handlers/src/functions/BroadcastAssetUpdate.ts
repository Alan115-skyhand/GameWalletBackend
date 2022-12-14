import { dynamoDBDocumentClient, assetStreamClient } from "../resources/Clients"
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi"
import { textEncoder } from "../resources/Tools"

export async function handler(event: any) {
    const update = JSON.parse(event.Records[0].Sns.Message)
    
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
    })
    
    const connections = response.Items ?? []
    
    for (const connection of connections) {
        await assetStreamClient.send(new PostToConnectionCommand({
            ConnectionId: connection.connectionId,
            Data: textEncoder.encode(JSON.stringify(update))
        })).catch(() => dynamoDBDocumentClient.delete({
            TableName: "CryptoAssetStreamConnections",
            Key: {
                "connectionId": connection.connectionId
            }
        }))
    }
}
