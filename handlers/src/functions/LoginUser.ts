import { LoginUserResponse } from "../../../server/src/responses/LoginUserResponse"
import { generateId, getEventBody, verifyUserPassword } from "../resources/Utils"
import { LoginUserRequest } from "../../../server/src/requests/LoginUserRequest"
import { dynamoDBDocumentClient } from "../resources/Clients"
import { User } from "../../../server/src/data/User"
import { UserCredentials } from "../../../server/src/data/UserCredentials"
import { UserToken } from "../../../server/src/data/UserToken"

export async function handler(event: any) {
    const request = getEventBody(event) as LoginUserRequest
    
    const user = await dynamoDBDocumentClient.scan({
        TableName: "CryptoUsers",
        // IndexName: "CryptoUsersEmailIndex",
        FilterExpression: "#email = :email",
        ExpressionAttributeNames: {
            "#email": "email"
        },
        ExpressionAttributeValues: {
            ":email": request.email
        }
    }).then(response => response.Items?.[0] as User ?? undefined)
    
    if (user === undefined) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: false,
                error: "Invalid Credentials"
            })
        }
    }
    
    const credentials = await dynamoDBDocumentClient.get({
        TableName: "CryptoUserCredentials",
        Key: {
            "user": user.id
        }
    }).then(response => response.Item as UserCredentials)
    
    if (!await verifyUserPassword(credentials, request.password)) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: false,
                error: "Invalid Credentials"
            })
        }
    }
    
    const token: UserToken = {
        user: user.id,
        token: generateId()
    }
    
    await dynamoDBDocumentClient.put({
        TableName: "CryptoUserTokens",
        Item: token
    })

    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            user: user.id,
            token: token.token
        })
    }
}
